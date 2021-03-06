# graphql-middleware-typed-arguments

GraphQL Middleware Typed Arguments lets you define a processor function to massage, validate, authorize, or whatever your query, mutation, or field arguments of a certain type.  The middleware was originally developed as [GraphQL Middleware Apollo Upload Server](https://www.npmjs.com/package/graphql-middleware-apollo-upload-server), which wonderfully separated streaming uploaded media to its ultimate destination from other concerns.

## Install

```bash
npm install graphql-middleware-typed-arguments
```

## Overview

`graphql-middleware-typed-arguments` lets you wrap a function around field arguments of any type.  The classic example is GraphQLUpload type in conjunction with Apollo Upload Server.  Now, also, you can attach an inspection function to any type of query argument, such as complicated validation of telephone numbers or delivery addresses where fields of the input object type depend upon each other in complex ways.  And there's more:  you can also produce middleware to visit all field arguments regardless of type.

## Features

- 👌 Easy to use.
- 🛴 Half automatic.
- 🏆 Works with every GraphQL server.

## Notes

If you would appreciate an integration of the [Yup validation framework](https://github.com/jquense/yup) to validate your scalar and object-type arguments, look at [this package](https://www.npmjs.com/package/graphql-yup-middleware).

## Demo

The example is taken directly from graphql-middleware-apollo-upload-server which was basis for this generalization.  There are two changes from the original:  the GraphQLUpload type object is imported, but the type name "Upload" could be used as well.  (In fact, type names are simpler way to get at a type defined in SDL.)  The second change is providing the type (object or string) to the middleware factory function provided by this package: `processTypeArgs`.  (The previous version's `upload` method has been preseved and implemented as a special case.)

```ts
import { GraphQLServer } from 'graphql-yoga'
import { GraphQLUpload } from 'apollo-upload-server'
import { S3 } from 'aws-sdk'
import { processTypeArgs } from 'graphql-middleware-typed-arguments'

const client = new S3({
  accessKeyId: __S3_KEY__,
  secretAccessKey: __S3_SECRET__,
  params: { Bucket: __S3_BUCKET__ },
})

const uploadToS3 = file => {
  const { stream, filename, mimetype, encoding } = file

  const response = client
    .upload({
      Key: filename,
      ACL: 'public-read',
      Body: file.stream,
    })
    .promise()
    .then( response => ({
      name: filename,
      url: response.Location
    }))
  }
}

const typeDefs = `
  scalar Upload

  type Query {
    me: User
  }

  type Mutation {
    signup(name: String!, password: String!, picture: Upload!): User
  }

  type User {
    id: ID!
    name: String!
    password: String!
    picture: File!
  }

  type File {
    id: ID!
    name: String!
    url: String!
  }
`

const resolvers = {
  Query: {
    me: getMyself
  },
  Mutation: {
    signup: async (parent, { name, password, picture }, ctx, info) => {
      // "picture" has already been uploaded!
      return ctx.db.createUser({
        data: {
          name,
          password,
          picture: picture.url
        }
      })
    }
  }
}

const server = new GraphQLServer({
  typeDefs,
  resolvers,
  middlewares: [processTypeArgs({ type: GraphQLUpload, transform: uploadToS3 })],
  context: req => ({
    ...req,
    db: new Prisma({
      endpoint: __PRISMA_ENDPOINT__,
    })
  })
})

server.listen(() => {
  console.log(`Server running on https://localhost:4000`)
})
```

## API

```ts
interface ITypeConfig<V, T> {
  type: GraphQLType | string
  transform: (value: V, root: any, args: {}, context: any, info: GraphQLResolveInfo) => Promise<T>
}

export const processTypeArgs<V, T> = (
  config: ITypeConfig<V, T>
): IMiddleware

interface IConfig {
  // behave yourself here:  the visitor should change type very carefully, such as dereferencing to validate an ID
  visitor: (value: any, root: any, args: {}, context: any, info: GraphQLResolveInfo) => Promise<any>
}

export const visitAllArgs = (
  config: IConfig
): IMiddleware

// Note that the visitor and transform functions receive all four resolver args (parent, args, context, & info),
// For these functions, info.argument has been set to refer to the relevant argument definition.

// input and output types are up to you, just provide the transform function
interface IFile {
  stream: string
  filename: string
  mimetype: string
  encoding: string
}

interface IRefS3 {
  name: string
  url: string
}

const middlewareFunction = processTypeArgs({
  type: 'Upload',
  transform: uploadToS3
})
```

## License

MIT @ Homeroom
