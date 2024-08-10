import { ApolloClient, InMemoryCache, gql, HttpLink } from "@apollo/client";
import { AcaiRecord, AcaiRecordFilter } from "../../types";
import fetch from "cross-fetch";

// Create Apollo Client with optional abort signal
const createClient = (signal?: AbortSignal) => {
  return new ApolloClient({
    link: new HttpLink({
      uri: "https://acai-resources-preview---symphony-api-svc-prod-25c5xl4maa-uk.a.run.app/graphql/",
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal }),
    }),
    cache: new InMemoryCache(),
  });
};

// GraphQL query for ACAI records
const ACAI_RECORD_QUERY = gql`
  query ACAIRecordsInPassage($acaiRecordsFilters: AcaiRecordFilter) {
    acaiRecords(filters: $acaiRecordsFilters) {
      id
      label
      description
      recordType
      uri
      articles {
        title
      }
      assets {
        title
        file
      }
    }
  }
`;

// Generic function to query ACAI records
async function queryAcaiRecords(
  filters: AcaiRecordFilter,
  signal?: AbortSignal
): Promise<AcaiRecord[]> {
  const client = createClient(signal);

  try {
    console.log(`Querying ATLAS with filters:`, filters);

    const { data } = await client.query({
      query: ACAI_RECORD_QUERY,
      variables: { acaiRecordsFilters: filters },
    });

    if (data.acaiRecords?.length > 0) {
      return data.acaiRecords;
    }
    throw new Error("No ACAI records found.");
  } catch (error) {
    console.error("Error querying ATLAS:", error);
    throw error;
  }
}

// Format verse reference for USFM
function formatVerseRef(bookId: string, verseRef: string): string {
  const parts = verseRef.split("-");

  if (parts.length === 1) {
    return `${bookId} ${verseRef}`.trim();
  } else if (parts.length === 2) {
    const [start, end] = parts;
    const [startChapter] = start.split(":");

    if (start.includes(":") && !end.includes(":")) {
      return `${bookId} ${start}-${startChapter}:${end}`;
    } else if (!end.includes(":")) {
      return `${bookId} ${start}-${bookId} ${startChapter}:${end}`;
    } else {
      return `${bookId} ${start}-${bookId} ${end}`;
    }
  }

  throw new Error("Invalid verse reference format");
}

// Main function to query ATLAS
export async function queryATLAS(
  bookId: string,
  verseRef: string,
  selectedTypes: string[],
  labelInput: string,
  searchType: string,
  signal?: AbortSignal
): Promise<AcaiRecord[]> {
  const filters: AcaiRecordFilter = {
    recordTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
    label: labelInput ? { iContains: labelInput } : undefined,
  };

  if (searchType === "Reference") {
    const usfmRef = formatVerseRef(bookId, verseRef);
    console.log(
      `Querying ATLAS for reference: ${usfmRef}, types: ${selectedTypes}, label: ${labelInput}`
    );
    filters.scriptureReference = { usfmRef };
  } else if (searchType === "Label") {
    console.log(
      `Querying ATLAS by label: ${labelInput}, types: ${selectedTypes}`
    );
  } else {
    throw new Error("Invalid search type");
  }

  return queryAcaiRecords(filters, signal);
}
