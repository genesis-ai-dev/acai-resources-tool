import React, { useState, useEffect, useRef, useCallback } from "react";
import "./ACAIResourceView.css";
import { AcaiRecord, BookData } from "../../../types";
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeCheckbox,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeTextField,
  vsCodeLink,
} from "@vscode/webview-ui-toolkit";
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
  VSCodeLink,
} from "@vscode/webview-ui-toolkit/react";

// Register VS Code design system components
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeCheckbox(),
  vsCodeDropdown(),
  vsCodeOption(),
  vsCodeTextField(),
  vsCodeLink()
);

// Enums and interfaces
enum RecordTypes {
  PERSON = "PERSON",
  PLACE = "PLACE",
  DEITY = "DEITY",
}

enum SearchType {
  REFERENCE = "Reference",
  LABEL = "Label",
}

interface ACAIResourceViewState {
  selectedOption: string;
  textInput: string;
  searchResult: AcaiRecord[] | null;
  error: string | null;
  isLoading: boolean;
  expandedResult: string | null;
  expandedGroups: RecordTypes[];
  isFilterExpanded: boolean;
  selectedTypes: RecordTypes[];
  searchType: SearchType;
  labelInput: string;
  topLevelLabelInput: string;
  pinnedRecords: AcaiRecord[];
  expandedPinnedRecords: Set<string>;
  isPinnedExpanded: boolean;
}

const initialState: ACAIResourceViewState = {
  selectedOption: "",
  textInput: "",
  searchResult: null,
  error: null,
  isLoading: false,
  expandedResult: null,
  expandedGroups: Object.values(RecordTypes),
  isFilterExpanded: false,
  selectedTypes: [],
  searchType: SearchType.REFERENCE,
  labelInput: "",
  topLevelLabelInput: "",
  pinnedRecords: [],
  expandedPinnedRecords: new Set(),
  isPinnedExpanded: true,
};

// VS Code API
const vscode = window.acquireVsCodeApi();

const ACAIResourceView: React.FC = () => {
  console.log("ACAIResourceView rendering");
  const [state, setState] = useState<ACAIResourceViewState>(initialState);
  const [options, setOptions] = useState<BookData[]>([]);
  const [searchId, setSearchId] = useState<string | null>(null);
  const isResetting = useRef(false);
  const [expandedDetailRecord, setExpandedDetailRecord] =
    useState<AcaiRecord | null>(null);
  const [pinnedRecords, setPinnedRecords] = useState<AcaiRecord[]>([]);

  const updateState = useCallback(
    (
      newState:
        | Partial<ACAIResourceViewState>
        | ((prevState: ACAIResourceViewState) => Partial<ACAIResourceViewState>)
    ) => {
      setState((prevState) => {
        const partialNewState =
          typeof newState === "function" ? newState(prevState) : newState;
        const updatedState = { ...prevState, ...partialNewState };
        vscode.postMessage({ command: "updateState", state: updatedState });
        return updatedState;
      });
    },
    []
  );

  const togglePinRecord = useCallback(
    (record: AcaiRecord, isPinnedVersion: boolean) => {
      setPinnedRecords((prevPinnedRecords) => {
        const isPinned = prevPinnedRecords.some((r) => r.id === record.id);

        if (isPinned && !isPinnedVersion) {
          return prevPinnedRecords;
        }

        let newPinnedRecords;
        if (isPinned) {
          newPinnedRecords = prevPinnedRecords.filter(
            (r) => r.id !== record.id
          );
        } else {
          newPinnedRecords = [...prevPinnedRecords, record];
        }

        updateState({ pinnedRecords: newPinnedRecords });
        return newPinnedRecords;
      });
    },
    [updateState]
  );

  const handleTypeChange = (type: RecordTypes) => {
    if (isResetting.current) return;

    updateState({
      selectedTypes: state.selectedTypes.includes(type)
        ? state.selectedTypes.filter((t) => t !== type)
        : [...state.selectedTypes, type],
    });
  };

  const handleSearchTypeChange = (event: Event) => {
    const newSearchType = (event.target as HTMLSelectElement)
      .value as SearchType;
    updateState({
      searchType: newSearchType,
      labelInput: "",
      topLevelLabelInput: "",
    });
  };

  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "setBookData":
          setOptions(message.bookData);
          break;
        case "searchResult":
          updateState({
            searchResult: message.result,
            error: null,
            isLoading: false,
          });
          break;
        case "searchError":
          updateState({
            error: message.error,
            searchResult: null,
            isLoading: false,
          });
          break;
        case "restoreState":
          setState((prevState) => ({
            ...prevState,
            ...message,
            pinnedRecords: message.pinnedRecords || [],
          }));
          setPinnedRecords(message.pinnedRecords || []);
          break;
      }
    };

    window.addEventListener("message", messageListener);
    vscode.postMessage({ command: "requestInitialData" });

    return () => window.removeEventListener("message", messageListener);
  }, []);

  useEffect(() => {
    if (options.length > 0 && state.selectedOption === "") {
      vscode.postMessage({ command: "requestStateRestore" });
    }
  }, [options, state.selectedOption]);

  const handleSearch = () => {
    if (!validateSearch()) return;

    const newSearchId = Date.now().toString();
    setSearchId(newSearchId);
    updateState({ isLoading: true, searchResult: null, error: null });

    vscode.postMessage({
      command: "search",
      bookId:
        state.searchType === SearchType.REFERENCE ? state.selectedOption : "",
      verseRef:
        state.searchType === SearchType.REFERENCE ? state.textInput : "",
      types: state.selectedTypes,
      searchType: state.searchType,
      labelInput:
        state.searchType === SearchType.LABEL
          ? state.topLevelLabelInput
          : state.labelInput,
      searchId: newSearchId,
    });
  };

  const validateSearch = () => {
    if (state.searchType === SearchType.REFERENCE) {
      if (!options.find((option) => option.id === state.selectedOption)) {
        updateState({ error: "Please select a book for reference search." });
        return false;
      }
    } else if (state.searchType === SearchType.LABEL) {
      if (!state.topLevelLabelInput) {
        updateState({ error: "Please enter a label for label search." });
        return false;
      }
    }
    return true;
  };

  const handleCancelSearch = () => {
    if (searchId) {
      vscode.postMessage({ command: "cancelSearch", searchId });
      setSearchId(null);
      updateState({ isLoading: false });
    }
  };

  const handleResultClick = useCallback((id: string, isPinned: boolean) => {
    console.log("handleResultClick called with:", id, isPinned);
    updateState((prevState) => {
      if (isPinned) {
        const newExpandedPinnedRecords = new Set(
          prevState.expandedPinnedRecords
        );
        if (newExpandedPinnedRecords.has(id)) {
          newExpandedPinnedRecords.delete(id);
        } else {
          newExpandedPinnedRecords.add(id);
        }
        return { expandedPinnedRecords: newExpandedPinnedRecords };
      } else {
        return { expandedResult: prevState.expandedResult === id ? null : id };
      }
    });
  }, []);

  const toggleGroup = useCallback((type: RecordTypes) => {
    updateState((prevState) => ({
      expandedGroups: prevState.expandedGroups.includes(type)
        ? prevState.expandedGroups.filter((t) => t !== type)
        : [...prevState.expandedGroups, type],
    }));
  }, []);

  const togglePinnedGroup = () => {
    updateState({ isPinnedExpanded: !state.isPinnedExpanded });
  };

  const togglePinnedRecord = (id: string) => {
    updateState((prevState) => {
      const newExpandedPinnedRecords = new Set(prevState.expandedPinnedRecords);
      if (newExpandedPinnedRecords.has(id)) {
        newExpandedPinnedRecords.delete(id);
      } else {
        newExpandedPinnedRecords.add(id);
      }
      return { expandedPinnedRecords: newExpandedPinnedRecords };
    });
  };

  const collapseAllPinnedRecords = () => {
    updateState({ expandedPinnedRecords: new Set() });
  };

  const renderDescription = (description: string | undefined) => {
    if (!description) {
      return <p>No description available.</p>;
    }
    return <div dangerouslySetInnerHTML={{ __html: description }} />;
  };

  const groupResultsByType = (
    results: AcaiRecord[]
  ): { [key in RecordTypes]: AcaiRecord[] } => {
    const grouped: { [key in RecordTypes]: AcaiRecord[] } = {
      [RecordTypes.PERSON]: [],
      [RecordTypes.PLACE]: [],
      [RecordTypes.DEITY]: [],
    };

    results.forEach((result) => {
      const types = result.recordType
        .split(",")
        .map((t) => t.trim().toUpperCase() as RecordTypes);
      types.forEach((type) => {
        if (type in RecordTypes) {
          grouped[type].push(result);
        }
      });
    });

    return grouped;
  };

  const renderResultItem = useCallback(
    (result: AcaiRecord, isPinned: boolean) => {
      console.log("renderResultItem called with:", result, isPinned);
      const isExpanded = isPinned
        ? state.expandedPinnedRecords.has(result.id)
        : state.expandedResult === result.id;

      return (
        <li key={result.id} className="result-item">
          <div
            className="result-label"
            onClick={() => handleResultClick(result.id, isPinned)}
          >
            {result.label}
            <span
              className={`codicon codicon-pin ${isPinned ? "pinned" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                togglePinRecord(result, isPinned);
              }}
              title={isPinned ? "Unpin" : "Pin"}
            ></span>
          </div>
          {isExpanded && renderResultDetails(result)}
        </li>
      );
    },
    [
      state.expandedResult,
      state.expandedPinnedRecords,
      togglePinRecord,
      handleResultClick,
    ]
  );

  const renderPinnedGroup = () => {
    console.log("renderPinnedGroup called");
    return (
      <div className="result-group">
        <div className="result-group-header">
          <h3
            className={`result-group-title ${
              state.isPinnedExpanded ? "expanded" : ""
            }`}
            onClick={togglePinnedGroup}
          >
            Pinned Records ({pinnedRecords.length})
          </h3>
          {state.isPinnedExpanded && pinnedRecords.length > 0 && (
            <VSCodeLink
              className="collapse-all"
              onClick={collapseAllPinnedRecords}
            >
              collapse all
            </VSCodeLink>
          )}
        </div>
        {state.isPinnedExpanded && pinnedRecords.length > 0 && (
          <ul className="result-list">
            {pinnedRecords.map((result) => renderResultItem(result, true))}
          </ul>
        )}
        {state.isPinnedExpanded && pinnedRecords.length === 0 && (
          <p>No pinned records yet.</p>
        )}
      </div>
    );
  };

  const renderResultGroup = useCallback(
    (type: RecordTypes, results: AcaiRecord[]) => {
      console.log("renderResultGroup called with:", type, results);
      if (results.length === 0) return null;

      const isExpanded = state.expandedGroups.includes(type);

      return (
        <div key={type} className="result-group">
          <h3
            className={`result-group-title ${isExpanded ? "expanded" : ""}`}
            onClick={() => toggleGroup(type)}
          >
            {type} ({results.length})
          </h3>
          {isExpanded && (
            <ul className="result-list">
              {results.map((result) => renderResultItem(result, false))}
            </ul>
          )}
        </div>
      );
    },
    [state.expandedGroups, renderResultItem, toggleGroup]
  );

  const renderResultDetails = (result: AcaiRecord) => (
    <div className="result-details">
      <h3
        className="result-details-label"
        onClick={() => setExpandedDetailRecord(result)}
        style={{ cursor: "pointer" }}
      >
        {result.label}
      </h3>
      <div className="result-description">
        {renderDescription(result.description)}
      </div>
      <div className="result-info">
        <p>
          <strong>Record Type:</strong> {result.recordType}
        </p>
        <p>
          <strong>URI:</strong> {result.uri}
        </p>
      </div>
      {result.articles && result.articles.length > 0 && (
        <div className="result-articles">
          <h4>Related Articles</h4>
          {result.articles.map((article, index) => (
            <div key={index} className="article-item">
              <h5>{article.title}</h5>
              <p>{article.localized?.en || "No English content available"}</p>
            </div>
          ))}
        </div>
      )}
      {result.assets && result.assets.length > 0 && (
        <div className="result-assets">
          <h4>Related Assets</h4>
          {result.assets.map((asset, index) => (
            <div key={index} className="asset-item">
              <h5>{asset.title}</h5>
              <p>File: {asset.file}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderExpandedDetailView = () => {
    if (!expandedDetailRecord) return null;

    return (
      <div className="expanded-detail-view">
        <VSCodeButton
          appearance="icon"
          aria-label="Go back"
          onClick={() => setExpandedDetailRecord(null)}
        >
          <i className="codicon codicon-arrow-left"></i>
        </VSCodeButton>
        <h2>{expandedDetailRecord.label}</h2>
        <div className="expanded-detail-content">
          {renderResultDetails(expandedDetailRecord)}
          <p>More info coming soon!</p>
        </div>
      </div>
    );
  };

  const handleResetFilters = () => {
    isResetting.current = true;
    updateState({
      selectedTypes: [],
      labelInput: "",
      textInput: "",
      selectedOption: "",
      topLevelLabelInput: "",
    });
    setTimeout(() => {
      isResetting.current = false;
    }, 0);
  };

  const renderTopLevelInputs = () => {
    if (state.searchType === SearchType.REFERENCE) {
      return (
        <>
          <select
            id="option-select"
            value={state.selectedOption}
            onChange={(e) => updateState({ selectedOption: e.target.value })}
            title="Select a book from the Bible"
          >
            <option value="">--</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="text-input"
            value={state.textInput}
            onChange={(e) => {
              const value = e.target.value;
              if (/^[0-9:\s-]*$/.test(value)) {
                updateState({ textInput: value });
              }
            }}
            placeholder="verse ref."
            title="Leave empty to search entire book; Enter a verse reference (e.g. 1:1, 1:1-5, 1:1-2:3)"
          />
        </>
      );
    } else {
      return (
        <input
          type="text"
          className="text-input full-width"
          value={state.topLevelLabelInput}
          onChange={(e) => updateState({ topLevelLabelInput: e.target.value })}
          placeholder="Enter label"
          title="Enter a label or partial label (e.g. 'Judah', 'el', 'Lord')"
        />
      );
    }
  };

  const renderFilterBoxInputs = () => {
    if (state.searchType === SearchType.REFERENCE) {
      return (
        <>
          <h4 className="filter-subheader">Label Filter:</h4>
          <div className="filter-row">
            <VSCodeTextField
              placeholder="Enter label"
              value={state.labelInput}
              onChange={(e: any) => updateState({ labelInput: e.target.value })}
            />
          </div>
        </>
      );
    } else {
      return (
        <>
          <h4 className="filter-subheader">Reference Filter:</h4>
          <div className="filter-row">
            <VSCodeDropdown
              value={state.selectedOption}
              onChange={(e: any) =>
                updateState({ selectedOption: e.target.value })
              }
            >
              <VSCodeOption value="">--</VSCodeOption>
              {options.map((option) => (
                <VSCodeOption key={option.id} value={option.id}>
                  {option.name}
                </VSCodeOption>
              ))}
            </VSCodeDropdown>
          </div>
          <div className="filter-row filter-row-gap">
            <VSCodeTextField
              placeholder="verse ref."
              value={state.textInput}
              onChange={(e: any) => updateState({ textInput: e.target.value })}
            />
          </div>
        </>
      );
    }
  };

  useEffect(() => {
    console.log("Component mounted or updated. Current state:", state);
  });

  return (
    <div className="acai-resource-view">
      {expandedDetailRecord ? (
        renderExpandedDetailView()
      ) : (
        <>
          <h1>ACAI Resources</h1>
          <div className="select-container">
            <label htmlFor="option-select">
              {state.searchType === SearchType.REFERENCE
                ? "Select a book and specify a verse reference:"
                : "Enter a label to search for:"}
            </label>
            <div className="input-wrapper">
              <div className="input-container">
                <VSCodeButton
                  appearance="icon"
                  aria-label="Toggle filter options"
                  onClick={() =>
                    updateState({ isFilterExpanded: !state.isFilterExpanded })
                  }
                  title="Click to show or hide additional filter options"
                >
                  <i className="codicon codicon-filter"></i>
                </VSCodeButton>
                {renderTopLevelInputs()}
                <button
                  className="search-button"
                  onClick={state.isLoading ? handleCancelSearch : handleSearch}
                  title={
                    state.isLoading
                      ? "Click to cancel search"
                      : "Click to search"
                  }
                >
                  {state.isLoading ? "Cancel Search" : "Search"}
                </button>
              </div>
              {state.isFilterExpanded && (
                <div className="filter-box">
                  <h4 className="filter-subheader">Search By:</h4>
                  <div className="search-input-container">
                    <VSCodeDropdown
                      value={state.searchType}
                      onChange={handleSearchTypeChange as any}
                      title="Select the type of search to perform"
                    >
                      {Object.values(SearchType).map((type) => (
                        <VSCodeOption key={type} value={type}>
                          {type}
                        </VSCodeOption>
                      ))}
                    </VSCodeDropdown>
                  </div>
                  {renderFilterBoxInputs()}
                  <h4 className="filter-subheader">Type Filter:</h4>
                  <div className="checkbox-group">
                    {Object.values(RecordTypes).map((type) => (
                      <VSCodeCheckbox
                        key={type}
                        checked={state.selectedTypes.includes(type)}
                        onChange={() =>
                          !isResetting.current && handleTypeChange(type)
                        }
                      >
                        {type.charAt(0) + type.slice(1).toLowerCase()}
                      </VSCodeCheckbox>
                    ))}
                  </div>
                  <VSCodeLink
                    className="reset-link"
                    onClick={handleResetFilters}
                  >
                    reset
                  </VSCodeLink>
                </div>
              )}
            </div>
          </div>

          {/* Pinned section - always visible */}
          <div className="pinned-section">{renderPinnedGroup()}</div>

          {/* Loading spinner */}
          {state.isLoading && <div className="loading-spinner"></div>}

          {/* Error message */}
          {state.error && <div className="error-message">{state.error}</div>}

          {/* Search Results section */}
          {state.searchResult && state.searchResult.length > 0 && (
            <div className="search-result">
              <h2 className="section-header">Search Result</h2>
              {Object.entries(groupResultsByType(state.searchResult)).map(
                ([type, results]) =>
                  renderResultGroup(
                    type as RecordTypes,
                    results as AcaiRecord[]
                  )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ACAIResourceView;
