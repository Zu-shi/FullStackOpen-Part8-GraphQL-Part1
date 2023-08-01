const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { v1: uuid } = require('uuid')
const mongoose = require('mongoose')
const Book = require('./models/book')
const Author = require('./models/author')
const defautCollection = require('./defaultCollection')
const { GraphQLError } = require('graphql');
const User = require('./models/user')
const jwt = require('jsonwebtoken')
const { applyMiddleware } = require('graphql-middleware');
const { makeExecutableSchema } = require('@graphql-tools/schema');

require('dotenv').config()

const CONNECTION_STRING = process.env.MONGODB_URI
const JWT_SECRET = process.env.JWT_SECRET

async function isDatabaseEmpty() {
  const collectionNames = await mongoose.connection.db.listCollections().toArray();

  for (let i = 0; i < collectionNames.length; i++) {
    const collectionName = collectionNames[i].name;
    const count = await mongoose.connection.db.collection(collectionName).countDocuments();

    if (count > 0) {
      return false;
    }
  }

  return true;
}

// usage
async function populateDatabase() {
  const isEmpty = await isDatabaseEmpty()

  console.log(`Is the database empty? ${isEmpty}`);

  if (isEmpty) {
    // insert default collections
    for (const authorJson of defautCollection.authors) {
      console.log(authorJson)
      const a = new Author({
        name: authorJson.name,
        born: authorJson.born
      })

      try {
        await a.save()
        console.log("test")
        console.log(models);
      } catch (err) {
        console.log("test2")
        console.log(err);
      };
    }

    for (const bookJson of defautCollection.books) {
      try {
        const a = await Author.findOne({ name: bookJson.author })

        console.log("searching for")
        console.log(bookJson)
        console.log(a)

        const b = new Book({
          title: bookJson.title,
          published: bookJson.published,
          author: a._id,
          genres: bookJson.genres
        })

        const res = await b.save()
        console.log(res);

      } catch (err) {
        if (err) {
          console.log(err);
        } else if (author) {
          console.log(author);
        } else {
          console.log('No author with that name has been found.');
        }
        return author;
      }
    }
  }
}


/*
  you can remove the placeholder query once your first own has been implemented 
*/

const typeDefs = `
  type Book 
  {
    title: String!
    published: Int!
    author: Author!
    genres: [String!]!
  }  

  type Author 
  {
    name: String!
    born: Int
  }

  type Query {
    bookCount: Int
    authorCount: Int 
    allBooks(author: String, genres: [String]): [Book!]!
    allAuthors: [Author!]!
    allGenres: [String!]!
    me: User
  }

  type Mutation {
    addBook(
      title: String!
      published: Int!
      author: String!
      genres: [String!]!
    ): Book

    editAuthor(
      name: String!
      setBornTo: Int!
    ): Author

    createUser(
      username: String!
      favoriteGenre: String!
    ): User

    login(
      username: String!
      password: String!
    ): Token
  }

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }
`

const resolvers = {
  Query: {
    me: (root, args, context) => {
      console.log("me", context)
      return context.currentUser
    },
    bookCount: () => Book.find({}).then((res) => res.length),
    authorCount: () => {
      console.log("authorCount")
      /*
      let counts = 0;
      let authors = {}
      books.forEach(book => {
        if (!authors[book.author]) {
          authors[book.author] = true
          counts += 1;
        }
      })
      return counts*/
      return Author.find({}).then((res) => res.length)
    },
    allBooks: async (_, { author, genres }) => {
      console.log("allBooks")
      console.log(genres)
      let conditions = {}
      if (author) {
        conditions["author"] == author
      }

      if (genres) {
        conditions["genres"] = { $in: genres }
        // not implemented
        // conditions[]
      }

      console.log(conditions)
      const b = await Book.find(conditions).populate('author').then((res) => res)
      console.log(b)
      return b
      /*
      if (!author && !genre) {
        return books; // If no authorName provided, return all books
      }
      let result = books

      if (author) {
        result = result.filter(book => book.author === author)
      }

      if (genre) {
        result = result.filter(book => book.genres.indexOf(genre) != -1)
      }*/

      // return result;
    },
    allGenres: async () => {
      console.log("allGenres")
      const genres = new Set()
      const books = await Book.find({})
      books.forEach((b) => b.genres.forEach((g) => genres.add(g)))
      console.log(Array.from(genres))
      return Array.from(genres);
    },
    allAuthors: async () => {
      console.log("allAuthors")
      const books = await Book.find({})
      const authors = await Author.find({})

      let tempAuthors = {}
      books.forEach(book => {
        if (tempAuthors[book.author] === undefined) {
          tempAuthors[book.author] = 1
        }
        else {
          tempAuthors[book.author] += 1
        }
      })

      let results = []

      authors.forEach((author) => {
        // console.log(author)
        // console.log(authors)
        results.push({
          name: author.name,
          born: author.born,
          bookCount: tempAuthors[author.name],
        })
      }
      )

      return results;
    },
  },
  Mutation: {
    addBook: async (_, { title, author, published, genres }, context) => {
      console.log("addBook")

      if (!context.currentUser) {
        throw new GraphQLError('Add book failed', {
          extensions: {
            code: 'INVALID_USER'
          }
        })
      }

      try {
        const authors = await Author.findOne({ name: author })
        let newAuthor = {}
        if (!authors) {
          newAuthor = await new Author({ name: author }).save()
        }

        const book = new Book({
          title: title,
          author: authors ? authors._id : newAuthor._id,
          published: published,
          genres: genres
        })

        await book.save()
        return Book.findOne({ title: title }).populate('author')
      }
      catch (err) {
        console.log(err)
        throw new GraphQLError('Add book failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: title,
            err
          }
        })
      }
    },
    editAuthor: async (_, { name, setBornTo }, context) => {
      console.log("editAuthor")
      console.log(name, setBornTo)

      if (!context.currentUser) {
        throw new GraphQLError('Add book failed', {
          extensions: {
            code: 'INVALID_USER'
          }
        })
      }

      const authors = await Author.findOne({ name: name })

      if (!authors) { return null }
      else {
        authors.born = setBornTo;
        try {
          return authors.save()
        }
        catch {
          throw new GraphQLError('Edit author failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: setBornTo,
              err
            }
          })
        }
      }

      // let result = null;
      // console.log("EditAuthor", name, setBornTo)
      // authors.forEach((author) => {
      //   if (author.name === name) {
      //     author.born = setBornTo
      //     result = author
      //   }
      // })
      // console.log(authors)
      // return result;
    },
    createUser: async (root, args) => {
      const user = new User({ username: args.username, favoriteGenre: args.favoriteGenre })

      return user.save()
        .catch(error => {
          throw new GraphQLError('Creating the user failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.name,
              error
            }
          })
        })
    },
    login: async (root, args) => {
      console.log("login", args)
      const user = await User.findOne({ username: args.username })

      if (!user || args.password !== 'secret') {
        throw new GraphQLError('wrong credentials', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        })
      }

      const userForToken = {
        username: user.username,
        id: user._id,
      }

      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) }
    },
  }
}

const loggerMiddleware = async (resolve, root, args, context, info) => {
  // Log the input to the resolver
  console.log(`Input: ${JSON.stringify(args)}`);

  // Call the resolver
  const result = await resolve(root, args, context, info);

  // Log the output from the resolver
  console.log(`Output: ${JSON.stringify(result)}`);

  return result;
};

// Assuming `typeDefs` and `resolvers` are your type definitions and resolvers
const schema = makeExecutableSchema({ typeDefs, resolvers });

const schemaWithMiddleware = applyMiddleware(
  schema,
  loggerMiddleware
);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  // schema: schemaWithMiddleware,
  debug: true,
  formatError: (err) => {
    console.log(err);
    return err;
  },
})

startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req, res }) => {
    const auth = req ? req.headers.authorization : null
    // console.log("req", req);
    if (auth && auth.startsWith('Bearer ')) {
      // console.log("Test", req);
      const decodedToken = jwt.verify(
        auth.substring(7), process.env.JWT_SECRET
      )
      const currentUser = await User.findById(decodedToken.id)
      if (currentUser) { console.log("Verified"); }
      return { currentUser }
    }
  }
}).then(async ({ url }) => {
  await mongoose.connect(CONNECTION_STRING)
  await populateDatabase()
  console.log(`Server ready at ${url}`)
})