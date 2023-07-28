const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { v1: uuid } = require('uuid')
const mongoose = require('mongoose')
const Book = require('./models/book')
const Author = require('./models/author')
const defautCollection = require('./defaultCollection')

require('dotenv').config()

const CONNECTION_STRING = process.env.MONGODB_URI

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
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
  }

  type Mutation {
    addBook(
      title: String!
      published: Int
      author: String!
      genres: [String!]!
    ): Book

    editAuthor(
      name: String!
      setBornTo: Int!
    ): Author
  }
`

const resolvers = {
  Query: {
    bookCount: () => books.length,
    authorCount: () => {
      let counts = 0;
      let authors = {}
      books.forEach(book => {
        if (!authors[book.author]) {
          authors[book.author] = true
          counts += 1;
        }
      })
      return counts
    },
    allBooks: (_, { author, genre }) => {
      if (!author && !genre) {
        return books; // If no authorName provided, return all books
      }
      let result = books

      if (author) {
        result = result.filter(book => book.author === author)
      }

      if (genre) {
        result = result.filter(book => book.genres.indexOf(genre) != -1)
      }

      return result;
    },
    allAuthors: () => {
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
        console.log(author)
        console.log(authors)
        results.push({
          name: author.name,
          born: author.born,
          bookCount: tempAuthors[author.name],
        })
      }
      )

      return results;
    }
  },
  Mutation: {
    addBook: (_, { title, author, published, genres }) => {
      const book = { title, author, published, genres, id: uuid() }
      books.push(book)

      if (authors.filter((author) => { author.name === author }).length === 0) {
        authors.push({
          name: author,
          id: uuid()
        })
      }

      return book
    },
    editAuthor: (_, { name, setBornTo }) => {
      let result = null;
      console.log("EditAuthor", name, setBornTo)
      authors.forEach((author) => {
        if (author.name === name) {
          author.born = setBornTo
          result = author
        }
      })
      console.log(authors)
      return result;
    }
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

startStandaloneServer(server, {
  listen: { port: 4000 },
}).then(async ({ url }) => {
  await mongoose.connect(CONNECTION_STRING)
  await populateDatabase()
  console.log(`Server ready at ${url}`)
})