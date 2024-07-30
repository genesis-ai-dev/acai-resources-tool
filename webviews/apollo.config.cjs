// For https://marketplace.visualstudio.com/items?itemName=apollographql.vscode-apollo
export default {
  client: {
    service: {
      name: 'Symphony API',
      url:
        import.meta.env.VITE_APP_ATLAS_GRAPHQL_ENDPOINT ||
        'https://acai-resources-preview---symphony-api-svc-prod-25c5xl4maa-uk.a.run.app/graphql/',
    },
    // Files processed by the extension
    includes: ['src/**/*.tsx'],
  },
}
