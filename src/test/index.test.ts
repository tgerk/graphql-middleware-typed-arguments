import test from 'ava'
import { makeExecutableSchema } from 'graphql-tools'
import { applyMiddleware } from 'graphql-middleware'
import { GraphQLUpload } from 'apollo-upload-server'
import { graphql, GraphQLString } from 'graphql'
import {
  findArgumentsOfType,
  reinjectArguments,
  processor,
} from '../'

interface IUpload {
  stream: string
  filename: string
  mimetype: string
  encoding: string
}

// Helpers

// Tests

test('Finds Argument With Type', async t => {
  t.plan(2)

  const typeDefs = `
    type Query {
      test(string: String, boolean: Boolean!): String!
    }
  `

  const resolvers = {
    Query: {
      test: (parent, args, ctx, infp) => 'pass',
    },
  }

  const middleware = {
    Query: {
      test: async (resolve, parent, args, ctx, info) => {
        const X = findArgumentsOfType(GraphQLString, info, args)
        t.is(X.length, 1)

        return resolve()
      },
    },
  }

  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const schemaWithMiddleware = applyMiddleware(schema, middleware)

  const query = `
    query {
      test(string: "trigger", boolean: true)
    }
  `

  // Execution
  const res = await graphql(schema, query)
  t.is(res.data.test, 'pass')
})

test(`Doesn't find Argument With Type`, async t => {
  t.plan(2)

  const typeDefs = `
    type Query {
      test(b1: Boolean!, b2: Boolean!): String!
    }
  `

  const resolvers = {
    Query: {
      test: (parent, args, ctx, info) => 'pass',
    },
  }

  const middleware = {
    Query: {
      test: async (resolve, parent, args, ctx, info) => {
        const X = findArgumentsOfType(GraphQLString, info, args)
        t.is(X.length, 0)

        return resolve()
      },
    },
  }

  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const schemaWithMiddleware = applyMiddleware(schema, middleware)

  const query = `
    query {
      test(b1: false, b2: true)
    }
  `

  // Execution
  const res = await graphql(schema, query)
  t.is(res.data.test, 'pass')
})

test('Finds Argument With List Type', async t => {
  t.plan(2)

  const typeDefs = `
    type Query {
      test(strings: [String]!, boolean: Boolean!): String!
    }
  `

  const resolvers = {
    Query: {
      test: (parent, args, ctx, infp) => 'pass',
    },
  }

  const middleware = {
    Query: {
      test: async (resolve, parent, args, ctx, info) => {
        const X = findArgumentsOfType(GraphQLString, info, args)
        t.is(X.length, 1)

        return resolve()
      },
    },
  }

  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const schemaWithMiddleware = applyMiddleware(schema, middleware)

  const query = `
    query {
      test(strings: ["trigger"], boolean: true)
    }
  `

  // Execution
  const res = await graphql(schema, query)
  t.is(res.data.test, 'pass')
})

test('Values in processor match', async t => {
  t.plan(2)

  const typeDefs = `
    type Query {
      test(string: String!): String!
    }
  `

  const resolvers = {
    Query: {
      test: (parent, args, ctx, infp) => 'pass',
    },
  }

  const middleware = {
    Query: {
      test: async (resolve, parent, args, ctx, info) => {
        const X = findArgumentsOfType(GraphQLString, info, args)
        t.is(X[0].argumentValue, 'trigger')

        return resolve()
      },
    },
  }

  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const schemaWithMiddleware = applyMiddleware(schema, middleware)

  const query = `
    query {
      test(string: "trigger")
    }
  `

  // Execution
  const res = await graphql(schema, query)
  t.is(res.data.test, 'pass')
})

test('Is GraphQLUpload type', async t => {
  t.plan(2)

  const typeDefs = `
    scalar Upload

    type Query {
      test(upload: Upload): String!
    }
  `

  const resolvers = {
    Query: {
      test: (parent, args, ctx, infp) => 'pass',
    },
    Upload: GraphQLUpload,
  }

  const middleware = {
    Query: {
      test: async (resolve, parent, args, ctx, info) => {
        const X = findArgumentsOfType(GraphQLUpload, info, args)
        t.is(X[0].argumentName, 'upload')

        return resolve()
      },
    },
  }

  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const schemaWithMiddleware = applyMiddleware(schema, middleware)

  const query = `
    query {
      test
    }
  `

  // Execution
  const res = await graphql(schema, query)
  t.is(res.data.test, 'pass')
})

test('Is GraphQLUpload List type', async t => {
  t.plan(2)

  const typeDefs = `
    scalar Upload

    type Query {
      test(upload: [Upload]): String!
    }
  `

  const resolvers = {
    Query: {
      test: (parent, args, ctx, infp) => 'pass',
    },
    Upload: GraphQLUpload,
  }

  const middleware = {
    Query: {
      test: async (resolve, parent, args, ctx, info) => {
        const X = findArgumentsOfType(GraphQLUpload, info, args)
        t.is(X[0].argumentName, 'upload')

        return resolve()
      },
    },
  }

  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const schemaWithMiddleware = applyMiddleware(schema, middleware)

  const query = `
    query {
      test
    }
  `

  // Execution
  const res = await graphql(schema, query)
  t.is(res.data.test, 'pass')
})

test('Identifies GraphQLUpload type correctly', async t => {
  t.plan(2)

  const typeDefs = `
    scalar Upload

    type Query {
      test(pass: [Upload]): String!
    }
  `

  const resolvers = {
    Query: {
      test: (parent, args, ctx, infp) => 'pass',
    },
    Upload: GraphQLUpload,
  }

  const middleware = {
    Query: {
      test: async (resolve, parent, args, ctx, info) => {
        const res = findArgumentsOfType(GraphQLUpload, info, args)
        t.deepEqual(res[0], {
          argumentName: 'pass',
          argumentValue: undefined,
        })

        return resolve()
      },
    },
  }

  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const schemaWithMiddleware = applyMiddleware(schema, middleware)

  const query = `
    query {
      test
    }
  `

  // Execution
  const res = await graphql(schema, query)
  t.is(res.data.test, 'pass')
})

test('Normalizes response correctly', async t => {
  const res = reinjectArguments({ arg1: 'X', arg2: 'Z', arg3: 'A' },
  [
    { argumentName: 'arg1', newArgumentValue: { value: 'x' } },
    { argumentName: 'arg2', newArgumentValue: { value: 'z' } },
  ])

  t.deepEqual(res, {
    arg1: { value: 'x' },
    arg2: { value: 'z' },
    arg3: 'A'
  })
})

test('Processor handles single file correctly', async t => {
  const uploadHandler = ({ stream, filename, mimetype, encoding }) =>
    new Promise(resolve =>
      setTimeout(
        () => resolve(`${stream}${filename}${mimetype}${encoding}`),
        10,
      ),
    )

  const res = await processor(uploadHandler)({
    argumentName: 'test',
    argumentValue: new Promise(resolve =>
      resolve({ stream: 's', filename: 'f', mimetype: 'm', encoding: 'e' }),
    ),
  })

  t.deepEqual(res, {
    argumentName: 'test',
    newArgumentValue: 'sfme',
  })
})

test('Processor handles multiple files correctly', async t => {
  const uploadHandler = ({ stream, filename, mimetype, encoding }) =>
    new Promise(resolve =>
      setTimeout(
        () => resolve(`${stream}${filename}${mimetype}${encoding}`),
        10,
      ),
    )

  const file = (x): Promise<IUpload> =>
    new Promise(resolve =>
      resolve({
        stream: `s${x}`,
        filename: `f${x}`,
        mimetype: `m${x}`,
        encoding: `e${x}`,
      }),
    )

  const res = await processor(uploadHandler)({
    argumentName: 'test',
    argumentValue: [file(1), file(2)],
  })

  t.deepEqual(res, {
    argumentName: 'test',
    newArgumentValue: ['s1f1m1e1', 's2f2m2e2'],
  })
})

test('Processor handles empty files correctly', async t => {
  const uploadHandler = ({ stream, filename, mimetype, encoding }) =>
    new Promise(resolve =>
      setTimeout(
        () => resolve(`${stream}${filename}${mimetype}${encoding}`),
        10,
      ),
    )

  const file = (x): Promise<IUpload> =>
    new Promise(resolve =>
      resolve({
        stream: `s${x}`,
        filename: `f${x}`,
        mimetype: `m${x}`,
        encoding: `e${x}`,
      }),
    )

  const res = await processor(uploadHandler)({
    argumentName: 'test',
    argumentValue: [file(1), null, undefined],
  })

  t.deepEqual(res, {
    argumentName: 'test',
    newArgumentValue: ['s1f1m1e1'],
  })
})

test('Processor handles no file correctly', async t => {
  const uploadHandler = ({ stream, filename, mimetype, encoding }) =>
    new Promise(resolve =>
      setTimeout(
        () => resolve(`${stream}${filename}${mimetype}${encoding}`),
        10,
      ),
    )

  const res = await processor(uploadHandler)({
    argumentName: 'test',
    argumentValue: null,
  })

  t.is(res, null)
})
