# graphql-middleware-typed-arguments

GraphQL Middleware Typed Arguments lets you define a processor function to massage, validate, authorize, or whatever your query, mutation, or field arguments of a certain type.  The middleware was originally developed as [GraphQL Middleware Apollo Upload Server](https://www.npmjs.com/package/graphql-middleware-apollo-upload-server), which wonderfully separated streaming uploaded media to its ultimate destination from other concerns.

## Install

```bash
npm install graphql-middleware-typed-arguments
```

## Overview

`graphql-middleware-typed-arguments` lets you wrap a function around field arguments of any type.  The classic example is GraphQLUpload type in conjunction with Apollo Upload Server.  Now, also, you can attach an inspection function to any type of query argument.

## Features

- 👌 Easy to use.
- 🛴 Half automatic.
- 🏆 Works with every GraphQL server.

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
interface IConfig<V, T> {
  type: GraphQLType | string
  transform: (value: V, root: any, args: {}, context: any, info: GraphQLResolveInfo) => Promise<T>
}

export const processTypeArgs<V, T> = (
  config: IConfig<V, T>
): IMiddleware

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
