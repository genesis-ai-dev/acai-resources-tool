import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

const client = new ApolloClient({
  uri: "https://acai-resources-preview---symphony-api-svc-prod-25c5xl4maa-uk.a.run.app/graphql/",
  cache: new InMemoryCache(),
});

export async function sendQuery(usfmRef: string): Promise<any> {
  try {
    console.log(`Querying ATLAS for USFM reference: ${usfmRef}`);

    const query = gql`
      query ACAIRecordsInPassage($acaiRecordsFilters: AcaiRecordFilter) {
        acaiRecords(filters: $acaiRecordsFilters) {
          id
          label
          recordType
          uri
        }
      }
    `;

    const { data } = await client.query({
      query,
      variables: {
        acaiRecordsFilters: {
          scriptureReference: {
            usfmRef,
          },
        },
      },
    });

    if (data.acaiRecords && data.acaiRecords.length > 0) {
      return data.acaiRecords;
    } else {
      throw new Error("No ACAI records found");
    }
  } catch (error) {
    console.error("Error querying ATLAS:", error);
    throw error;
  }
}

function formatVerseRef(bookId: string, verseRef: string): string {
  const parts = verseRef.split("-");

  if (parts.length === 1) {
    // Single verse or chapter:verse
    return `${bookId} ${verseRef}`;
  } else if (parts.length === 2) {
    const [start, end] = parts;

    if (start.includes(":") && !end.includes(":")) {
      // Range within the same chapter
      const [chapter] = start.split(":");
      return `${bookId} ${start}-${chapter}:${end}`;
    } else if (!end.includes(":")) {
      // Range spanning chapters
      const [startChapter] = start.split(":");
      return `${bookId} ${start}-${bookId} ${startChapter}:${end}`;
    } else {
      // Full range
      return `${bookId} ${start}-${bookId} ${end}`;
    }
  }

  throw new Error("Invalid verse reference format");
}

export async function queryATLAS(
  bookId: string,
  verseRef: string
): Promise<any> {
  const usfmRef = formatVerseRef(bookId, verseRef);
  console.log(`Querying ATLAS for combined reference: ${usfmRef}`);
  return sendQuery(usfmRef);
}
