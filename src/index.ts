import {
  GraphQLResolveInfo,
  GraphQLArgument,
  GraphQLField,
  getNamedType,
  GraphQLType,
} from 'graphql'
import { IMiddlewareFunction } from 'graphql-middleware'

// Utilities -----------------------------------------------------------------

type Maybe<T> = T | null

/**
 *
 * @param f
 * @param xs
 *
 * applies a map function to each member of an array
 * returns non-null results in a new array
 *
 */
function filterMap<T, U>(f: (x: T) => Maybe<U>, xs: T[]): U[] {
  return xs.reduce((acc: U[], x: T): U[] => {
    const res: Maybe<U> = f(x)
    if (res !== null) {
      // https://www.measurethat.net/Benchmarks/Show/2336/0/arrayprototypeconcat-vs-spread-operator-vs-push
      // shows `acc.push(res)` is 20% faster than `acc = [ res, ... acc ]`
      // plus in context I see no benefit to treat accumulator as a reference to an immutable array.
      acc.push(res)
    }

    return acc
  }, [])
}

/**
 *
 * @param info
 *
 * Gets argument definitions for the current resolver.
 *
 */
function getFieldArguments(info: GraphQLResolveInfo): GraphQLArgument[] {
  const { fieldName, parentType } = info
  const typeFields = parentType.getFields()
  return typeFields[fieldName].args
}

/**
 *
 * @param type
 * @param info
 *
 * Finds field arguments of the specfied type
 *
 */
export function findArgumentsOfType(
  type: string | GraphQLType,
  info: GraphQLResolveInfo,
): Maybe<GraphQLArgument[]> {
  const fieldArguments = getFieldArguments(info)
  return filterMap((argDef: GraphQLArgument): Maybe<GraphQLArgument> => {
    if (
      getNamedType(argDef.type).name ===
      (typeof type === 'string' ? type : getNamedType(type).name)
    ) {
      return argDef
    }

    return null
  }, fieldArguments)
}

/**
 *
 * @param args
 * @param arg
 *
 * Gets the value for argument definition.
 *
 */
export function getArgumentValue(
  args: { [key: string]: any },
  arg: GraphQLArgument,
): any {
  return args[arg.name]
}

// Helper --------------------------------------------------------------------

declare type IHandledArg<T> = [string, T | T[]]

/**
 *
 * @param transform
 * @param usual four resolver parameters
 *
 * Higher-order function that produces a map function over argument definitions
 * of a certain type.  Argument values and lists are transformed
 *
 */
export function makeArgumentTransform<T, V>(
  transform: ITypeArgumentHandler<V, T>,
  parent,
  args,
  ctx,
  info,
) {
  return function(
    argumentDef: GraphQLArgument,
  ): Maybe<Promise<IHandledArg<T>>> {
    const argumentName = argumentDef.name
    const argumentValue:
      | V
      | Promise<V>
      | Array<V | Promise<V>> = getArgumentValue(args, argumentDef)
    info.argument = argumentDef
    if (Array.isArray(argumentValue)) {
      return Promise.all(
        argumentValue.reduce(
          (acc: Array<Promise<T>>, elem: V | Promise<V>): Array<Promise<T>> => {
            if (elem !== undefined && elem !== null) {
              if (elem instanceof Promise) {
                return [
                  ...acc,
                  elem.then(e => transform(e, parent, args, ctx, info)),
                ]
              }
              return [
                ...acc,
                Promise.resolve(transform(elem, parent, args, ctx, info)),
              ]
            }
            return acc
          },
          [],
        ),
      ).then((res: T[]): IHandledArg<T> => [argumentName, res])
    }

    if (argumentValue !== undefined && argumentValue !== null) {
      if (argumentValue instanceof Promise) {
        return argumentValue
          .then(e => transform(e, parent, args, ctx, info))
          .then((res: T): IHandledArg<T> => [argumentName, res])
      }

      return Promise.resolve(
        transform(argumentValue, parent, args, ctx, info),
      ).then((res: T): IHandledArg<T> => [argumentName, res])
    }

    return null // exclude arguments when no value provided
  }
}

// Interface -----------------------------------------------------------------

// transformation function type
export declare type ITypeArgumentHandler<V, T> = (
  value: V | Promise<V>,
  parent: {},
  args: {},
  context: {},
  info: GraphQLResolveInfo,
) => Promise<T> // the field resolver expects arg of type T

export interface IConfig<V, T> {
  type: string | GraphQLType // name of type or type object describing V
  transform: ITypeArgumentHandler<V, T> // value transformation function
}

/**
 *
 * @param config
 *
 * A higher-order function which produces a middleware to transform
 * field arguments of a given type.
 *
 */
export function processTypeArgs<V, T>({
  type,
  transform,
}: IConfig<V, T>): IMiddlewareFunction {
  return (resolve, parent, args, ctx, info) => {
    const argDefs = findArgumentsOfType(type, info)
    if (argDefs.length) {
      // Apply argument transform function to arguments of the selected type
      // The caller's transform function is applied to values that may be embedded
      // in lists and promises, but not to null or undefined values
      // Finally the resolver is called with transformed argument values
      return (
        Promise.all(
          filterMap(
            makeArgumentTransform(transform, parent, args, ctx, info),
            argDefs,
          ),
        )
          // substitute the transformed values into the args object
          .then(result =>
            result.reduce(
              (args, [name, newValue]) => (args[name] = newValue),
              args,
            ),
          )
          .then(newArgs => resolve(parent, newArgs, ctx, info))
      )
    }

    return resolve(parent, args, ctx, info)
  }
}

export function visitAllArgs({ visitor }): IMiddlewareFunction {
  return (resolve, parent, args, ctx, info) => {
    const argDefs = getFieldArguments(info)
    if (argDefs.length) {
      // Apply argument transform function to all arguments
      // The caller's visitor function is applied to values that may be embedded
      // in lists and promises, but not to null or undefined values
      // Finally the resolver is called with transformed argument values
      return (
        Promise.all(
          filterMap(
            makeArgumentTransform(visitor, parent, args, ctx, info),
            argDefs,
          ),
        )
          // substitute the transformed values into the args object
          .then(result =>
            result.reduce(
              (args, [name, newValue]) => (args[name] = newValue),
              args,
            ),
          )
          .then(newArgs => resolve(parent, newArgs, ctx, info))
      )
    }

    return resolve(parent, args, ctx, info)
  }
}

// Preceding revision as a special case --------------------------------------

// this object shape is defined by Apollo Upload Server v5.0.0
export interface IUploadFile {
  stream
  filename
  mimetype
  encoding
}

declare type IUploadHandler<T> = (upload: IUploadFile) => Promise<T>

export interface IUploadConfig<T> {
  uploadHandler: IUploadHandler<T>
}

export function upload<T>({
  uploadHandler,
}: IUploadConfig<T>): IMiddlewareFunction {
  return processTypeArgs({ type: 'Upload', transform: uploadHandler })
}
