import {
  GraphQLResolveInfo,
  GraphQLArgument,
  GraphQLField,
  getNamedType,
  GraphQLType,
} from 'graphql'
import { GraphQLUpload } from 'apollo-upload-server'
import { IMiddlewareFunction } from 'graphql-middleware'

type Maybe<T> = T | null

/**
 *
 * @param f
 * @param xs
 *
 * applies a map function to each member of an array
 * returns non-null result as a new array
 *
 */
function filterMap<T, U>(f: (x: T) => Maybe<U>, xs: T[]): U[] {
  return xs.reduce((acc, x) => {
    const res = f(x)
    if (res !== null) {
      return [res, ...acc]
    } else {
      return acc
    }
  }, [])
}

// GraphQL info mining -------------------------------------------------------

/**
 *
 * @param info
 *
 * Returns GraphQLField type of the current resolver.
 *
 */
function getResolverField(
  info: GraphQLResolveInfo,
): GraphQLField<any, any, { [key: string]: any }> {
  const { fieldName, parentType } = info
  const typeFields = parentType.getFields()

  return typeFields[fieldName]
}

/**
 *
 * @param field
 *
 * Returns arguments that certain field accepts.
 *
 */
function getFieldArguments<TSource, TContext, TArgs>(
  field: GraphQLField<TSource, TContext, TArgs>,
): GraphQLArgument[] {
  return field.args
}

/**
 *
 * @param args
 * @param arg
 *
 * Finds the value of argument from provided argument values and
 * argument definition.
 *
 */
function getArgumentValue(args: { [key: string]: any }, arg: GraphQLArgument) {
  return args[arg.name]
}

/**
 *
 * @param f
 * @param info
 * @param args
 *
 * Executes a function on all arguments and their values of the current field
 * returns an array of the function's results if not null
 *
 */
export function findArgumentsOfType<V>(
  type: GraphQLType,
  info: GraphQLResolveInfo,
  args: { [key: string]: any }, // some args have type V | V[] | Promise<V> | Promise<V>[], and we are here to find them
): ITypeArgument<V>[] {
  const argSelector = (argDef: GraphQLArgument): Maybe<ITypeArgument<V>> => {
    if (getNamedType(argDef.type).name === getNamedType(type).name) {
      return {
        argumentName: argDef.name,
        argumentValue: getArgumentValue(args, argDef),
      }
    }

    return null
  }

  const field = getResolverField(info)
  const fieldArguments = getFieldArguments(field)
  return filterMap(argSelector, fieldArguments)
}

// Argument detection and modificaton ----------------------------------------

interface IConfig<V, T> {
  type: GraphQLType
  handler: ITypeArgumentHandler<V, T>
}

interface ITypeArgument<V> {
  argumentName: string
  argumentValue: V | Promise<V> | Array<V | Promise<V>>
}

declare type ITypeArgumentHandler<V, T> = (value: V | Promise<V>) => Promise<T>

interface ITypeArgumentHandled<T> {
  argumentName: string
  newArgumentValue: T | T[]
}

/**
 *
 * @param handler
 *
 * Higher-order function that produces a function which applies handler to appropriate way
 * to array or scalar, promise or not.
 * apollo-upload-server has provided promises referring to sections of a multipart request
 * for arguments of type GraphQLUpdate, any other argument types may not be a "thenable",
 * just use Promise.resolve(handler(value))
 * Returns a promise or array of promises for the transfigured argument value.
 *
 */
export function processor<T, V>(handler: ITypeArgumentHandler<V, T>) {
  return function({
    argumentName,
    argumentValue,
  }: ITypeArgument<V>): Maybe<Promise<ITypeArgumentHandled<T>>> {
    if (Array.isArray(argumentValue)) {
      return Promise.all(
        argumentValue.reduce(
          (acc: Array<Promise<T>>, elem: V | Promise<V>): Array<Promise<T>> => {
            if (elem !== undefined && elem !== null) {
              if (elem instanceof Promise) {
                return [...acc, elem.then(handler)]
              }
              return [...acc, Promise.resolve(handler(elem))]
            }
            return acc
          },
          [],
        ),
      ).then(
        (res: T[]): ITypeArgumentHandled<T> => ({
          argumentName: argumentName,
          newArgumentValue: res,
        }),
      )
    }

    if (argumentValue !== undefined && argumentValue !== null) {
      if (argumentValue instanceof Promise) {
        return argumentValue.then(handler).then(
          (res: T): ITypeArgumentHandled<T> => ({
            argumentName: argumentName,
            newArgumentValue: res,
          }),
        )
      }

      return Promise.resolve(handler(argumentValue)).then(
        (res: T): ITypeArgumentHandled<T> => ({
          argumentName: argumentName,
          newArgumentValue: res,
        }),
      )
    }

    return null
  }
}

/**
 *
 * @param args
 * @param handledArgs
 *
 * Replaces inital argument values with their transformations
 *
 */
export function reinjectArguments<T>(
  args: { [key: string]: any },
  handledArgs: ITypeArgumentHandled<T>[],
): { [key: string]: any } {
  const newArgs = handledArgs.reduce(
    (acc, val) => ({ ...acc, [val.argumentName]: val.newArgumentValue }),
    {},
  )
  return { ...args, ...newArgs }
}

/**
 *
 * @param config
 *
 * A higher-order function which produces a middleware resolver to process
 * input arguments of a given type.  We find all argument values of `type`,
 * which may already be then-able promises.  We either add a "then(handler)"
 * or create a new promise resolved to handler(value).  Results replace their
 * starting values in the arguments object passed to the next resolver.
 *
 */
export function processTypeArgs<V, T>({
  type,
  handler,
}: IConfig<V, T>): IMiddlewareFunction {
  return (resolve, parent, args, ctx, info) => {
    const typeArgs = findArgumentsOfType(type, info, args)

    if (typeArgs.length) {
      return Promise.all(filterMap(processor(handler), typeArgs))
        .then(handledArgs => reinjectArguments(args, handledArgs))
        .then(updatedArgs => resolve(parent, updatedArgs, ctx, info))
    }

    return resolve(parent, args, ctx, info)
  }
}
