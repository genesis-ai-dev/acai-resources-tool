let ApolloClient: any, InMemoryCache: any, gql: any;

// Dynamic import of Apollo Client modules
import("@apollo/client/core").then((module) => {
  ApolloClient = module.ApolloClient;
  InMemoryCache = module.InMemoryCache;
  gql = module.gql;
});

// Create an Apollo Client instance
let client: any;

async function initializeClient() {
  if (!client) {
    client = new ApolloClient({
      uri: "YOUR_ATLAS_API_ENDPOINT", // Replace with the actual ATLAS API endpoint
      cache: new InMemoryCache(),
    });
  }
}

export async function queryATLAS(
  bookId: string,
  verseRef: string
): Promise<any> {
  await initializeClient();

  const QUERY = gql`
    query GetPassage($scriptureReference: ScriptureReferenceInput!) {
      passage(filters: { scriptureReference: $scriptureReference }) {
        ref
        textContent
        textualEdition {
          usfmRef
        }
      }
    }
  `;

  try {
    const { data } = await client.query({
      query: QUERY,
      variables: {
        scriptureReference: {
          usfmRef: `${bookId} ${verseRef}`,
        },
      },
    });

    return data.passage[0]; // Assuming the query returns an array with one passage
  } catch (error) {
    console.error("Error querying ATLAS:", error);
    throw error;
  }
}
