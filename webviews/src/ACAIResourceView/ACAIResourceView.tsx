import React, { useState, useEffect } from "react";
import { useQuery, gql } from '@apollo/client'

import "./ACAIResourceView.css";

declare global {
  interface Window {
    acquireVsCodeApi: () => any;
  }
}
// Ensure that the acquireVsCodeApi function is defined in the window object
const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : undefined;


const ACAI_RECORDS_IN_PASSAGE = gql`
  query ACAIRecordsInPassage($acaiRecordsFilters: AcaiRecordFilter) {
    acaiRecords(filters: $acaiRecordsFilters) {
      label
      uri
    }
  }
`
const ACAIResourceView: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState("");
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "setOptions":
          setOptions(message.options);
          break;
      }
    };

    window.addEventListener("message", messageListener);

    return () => window.removeEventListener("message", messageListener);
  }, []);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOption(event.target.value);
    vscode.postMessage({
      command: "optionSelected",
      value: event.target.value,
    });
  };
  const queryVariables = {
    "acaiRecordsFilters": {
      "scriptureReference": {
        "usfmRef": "JHN 6:1",
        "textualEdition": "SBLGNT"
      }
    }
  }
  const { loading, error, data } = useQuery(ACAI_RECORDS_IN_PASSAGE, {
    variables: queryVariables,
  })

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error : {error.message}</p>

  return (
    <div>
      <select value={selectedOption} onChange={handleSelectChange}>
        <option value="">Select an option</option>
        {options.map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
      <h1>ACAI Resources</h1>
      <p>Welcome to the ACAI Resources tool!</p>
      <p>Selected option: {selectedOption}</p>
      {data && data.acaiRecords && (
        <ul>
          {data.acaiRecords.map((record: any) => (
            <li key={record.uri}>
              {record.label} - {record.uri}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ACAIResourceView;
