import test from 'ava'
import { makeExecutableSchema } from 'graphql-tools'
import { applyMiddleware } from 'graphql-middleware'
import { GraphQLUpload } from 'graphql-upload'
import { graphql, GraphQLList, GraphQLString, GraphQLScalarType } from 'graphql'
import {
  findArgumentsOfType,
  getArgumentValue,
  makeArgumentTransform,
  processTypeArgs,
} from '../index'

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
        const X = findArgumentsOfType(GraphQLString, info)
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
        const X = findArgumentsOfType(GraphQLString, info)
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
        const X = findArgumentsOfType(GraphQLString, info)
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
        const X = findArgumentsOfType(GraphQLString, info)
        t.is(getArgumentValue(args, X[0]), 'trigger')

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
        const X = findArgumentsOfType(GraphQLUpload, info)
        t.is(X[0].name, 'upload')

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
        const X = findArgumentsOfType(GraphQLUpload, info)
        t.is(X[0].name, 'upload')

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
  t.plan(3)

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
        const res = findArgumentsOfType(GraphQLUpload, info)
        t.is(res[0].name, 'pass')
        t.is(getArgumentValue(args, res[0]), undefined)

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

test('Processor handles single file correctly', async t => {
  const uploadHandler = ({ stream, filename, mimetype, encoding }) =>
    new Promise(resolve =>
      setTimeout(
        () => resolve(`${stream}${filename}${mimetype}${encoding}`),
        10,
      ),
    )

  let args = {
    test: new Promise(resolve =>
      resolve({ stream: 's', filename: 'f', mimetype: 'm', encoding: 'e' }),
    ),
  }
  const res = await makeArgumentTransform(uploadHandler, {}, args, {}, {})({
    name: 'test',
    type: GraphQLUpload,
  })

  t.deepEqual(res, { test: 'sfme' })
})

test('Processor handles multiple files correctly', async t => {
  const uploadHandler = ({ stream, filename, mimetype, encoding }) =>
    new Promise(resolve =>
      setTimeout(
        () => resolve(`${stream}${filename}${mimetype}${encoding}`),
        10,
      ),
    )

  const file = x =>
    new Promise(resolve =>
      resolve({
        stream: `s${x}`,
        filename: `f${x}`,
        mimetype: `m${x}`,
        encoding: `e${x}`,
      }),
    )

  const args = {
    test: [file(1), file(2)],
  }
  const res = await makeArgumentTransform(uploadHandler, {}, args, {}, {})({
    name: 'test',
    type: new GraphQLList(GraphQLUpload),
  })

  t.deepEqual(res, { test: ['s1f1m1e1', 's2f2m2e2'] })
})

test('Processor handles empty files correctly', async t => {
  const uploadHandler = ({ stream, filename, mimetype, encoding }) =>
    new Promise(resolve =>
      setTimeout(
        () => resolve(`${stream}${filename}${mimetype}${encoding}`),
        10,
      ),
    )

  const file = x =>
    new Promise(resolve =>
      resolve({
        stream: `s${x}`,
        filename: `f${x}`,
        mimetype: `m${x}`,
        encoding: `e${x}`,
      }),
    )

  const args = {
    test: [file(1), null, undefined],
  }
  const res = await makeArgumentTransform(uploadHandler, {}, args, {}, {})({
    name: 'test',
    type: new GraphQLList(GraphQLUpload),
  })

  t.deepEqual(res, { test: ['s1f1m1e1'] })
})

test('Processor handles no file correctly', async t => {
  const uploadHandler = ({ stream, filename, mimetype, encoding }) =>
    new Promise(resolve =>
      setTimeout(
        () => resolve(`${stream}${filename}${mimetype}${encoding}`),
        10,
      ),
    )
  const args = {
    test: null,
  }
  const res = await makeArgumentTransform(uploadHandler, {}, args, {}, {})({
    name: 'test',
    type: GraphQLString,
  })

  t.is(res, null)
})

test('processTypeArgs applies a transformation correctly', async t => {
  // write a schema, an arg transform, and a query
  t.plan(5)

  let theValue = 'some-random-string'

  const typeDefs = `
    scalar Custom

    type Query {
      test(pass: Custom): [String]!
    }
  `

  const resolvers = {
    Query: {
      test: (parent, args, ctx, infp) => {
        t.deepEqual(args, { pass: String('-' + theValue + '-').toUpperCase() })
        return String(args.pass).split('-')
      },
    },
    Custom: new GraphQLScalarType({
      name: 'Custom',
      serialize: x => x,
      parseValue: x => x,
      parseLiteral: x => {
        t.is(x['value'], theValue)
        return `-${x['value']}-`
      },
    }),
  }

  const middleware = {
    Query: {
      test: processTypeArgs({
        type: 'Custom',
        transform: x => {
          t.is(x, '-' + theValue + '-')
          return Promise.resolve(String(x).toUpperCase())
        },
      }),
    },
  }

  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const schemaWithMiddleware = applyMiddleware(schema, middleware)

  const query = `
    query {
      test(pass: "${theValue}")
    }
  `

  // Execution
  const res = await graphql(schema, query)
  t.deepEqual(
    res.data.test,
    String('-' + theValue + '-')
      .toUpperCase()
      .split('-'),
  )
})
