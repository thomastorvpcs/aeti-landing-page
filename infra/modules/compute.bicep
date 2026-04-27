param location string
param staticSiteLocation string
param appServicePlanName string
param appServicePlanSku string
param apiAppName string
param workerAppName string
param staticWebAppName string
param staticWebAppSku string
param keyVaultName string
param pcsOpsEmail string
param pcsLegalEmail string
param pcsLegalName string
param docusignBasePath string

// When true, both App Services are connected to the VNet so they can reach
// the private PostgreSQL server. Requires P1v3 or higher App Service Plan.
param enablePrivateNetworking bool = false
param appServiceSubnetId string = ''

// Builds the Key Vault Reference string for a given secret name.
// The App Service runtime resolves these at startup; the application code sees
// the plain secret value and requires no changes.
var kvRef = 'VaultName=${keyVaultName};SecretName='

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: { name: appServicePlanSku }
  properties: {
    reserved: true // required for Linux
  }
}

// Static Web App (frontend)
// Deployed separately via GitHub Actions; resource provisioned here to establish
// the managed resource and expose the default hostname for ALLOWED_ORIGINS.
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: staticSiteLocation
  sku: {
    name: staticWebAppSku
    tier: staticWebAppSku
  }
  properties: {}
}

// Web API
resource apiApp 'Microsoft.Web/sites@2023-01-01' = {
  name: apiAppName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: [
        // Plain values
        { name: 'NODE_ENV', value: 'production' }
        { name: 'ALLOWED_ORIGINS', value: 'https://${staticWebApp.properties.defaultHostname}' }
        { name: 'AZURE_BLOB_CONTAINER', value: 'reseller-docs' }
        { name: 'AZURE_SERVICE_BUS_QUEUE_NAME', value: 'onboarding-jobs' }
        { name: 'ACROBAT_API_BASE_URL', value: 'https://api.na4.adobesign.com' }
        { name: 'DOCUSIGN_BASE_PATH', value: docusignBasePath }
        { name: 'PCS_OPS_EMAIL', value: pcsOpsEmail }
        { name: 'PCS_LEGAL_EMAIL', value: pcsLegalEmail }
        { name: 'PCS_LEGAL_NAME', value: pcsLegalName }
        { name: 'SENDGRID_FROM_EMAIL', value: 'resellers@pcsww.com' }
        { name: 'SENDGRID_FROM_NAME', value: 'PCS Partner Program' }
        // Key Vault references
        { name: 'DATABASE_URL', value: '@Microsoft.KeyVault(${kvRef}database-url)' }
        { name: 'AZURE_STORAGE_CONNECTION_STRING', value: '@Microsoft.KeyVault(${kvRef}storage-connection-string)' }
        {
          name: 'AZURE_SERVICE_BUS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(${kvRef}servicebus-connection-string)'
        }
        { name: 'JWT_SECRET', value: '@Microsoft.KeyVault(${kvRef}jwt-secret)' }
        { name: 'ADMIN_SECRET', value: '@Microsoft.KeyVault(${kvRef}admin-secret)' }
        { name: 'SENDGRID_API_KEY', value: '@Microsoft.KeyVault(${kvRef}sendgrid-api-key)' }
        { name: 'SENDGRID_TEMPLATE_WELCOME', value: '@Microsoft.KeyVault(${kvRef}sendgrid-template-welcome)' }
        {
          name: 'SENDGRID_TEMPLATE_INTERNAL_ALERT'
          value: '@Microsoft.KeyVault(${kvRef}sendgrid-template-internal-alert)'
        }
        { name: 'ACROBAT_CLIENT_ID', value: '@Microsoft.KeyVault(${kvRef}acrobat-client-id)' }
        { name: 'ACROBAT_CLIENT_SECRET', value: '@Microsoft.KeyVault(${kvRef}acrobat-client-secret)' }
        { name: 'ACROBAT_REFRESH_TOKEN', value: '@Microsoft.KeyVault(${kvRef}acrobat-refresh-token)' }
        { name: 'ACROBAT_NDA_TEMPLATE_ID', value: '@Microsoft.KeyVault(${kvRef}acrobat-nda-template-id)' }
        { name: 'NETSUITE_ACCOUNT_ID', value: '@Microsoft.KeyVault(${kvRef}netsuite-account-id)' }
        { name: 'NETSUITE_CONSUMER_KEY', value: '@Microsoft.KeyVault(${kvRef}netsuite-consumer-key)' }
        { name: 'NETSUITE_CONSUMER_SECRET', value: '@Microsoft.KeyVault(${kvRef}netsuite-consumer-secret)' }
        { name: 'NETSUITE_TOKEN_ID', value: '@Microsoft.KeyVault(${kvRef}netsuite-token-id)' }
        { name: 'NETSUITE_TOKEN_SECRET', value: '@Microsoft.KeyVault(${kvRef}netsuite-token-secret)' }
        { name: 'NETSUITE_SUBSIDIARY_ID', value: '@Microsoft.KeyVault(${kvRef}netsuite-subsidiary-id)' }
        { name: 'NETSUITE_FINANCE_EMPLOYEE_ID', value: '@Microsoft.KeyVault(${kvRef}netsuite-finance-employee-id)' }
        { name: 'NETSUITE_LEGAL_EMPLOYEE_ID', value: '@Microsoft.KeyVault(${kvRef}netsuite-legal-employee-id)' }
        {
          name: 'NETSUITE_FILE_CABINET_FOLDER_ID'
          value: '@Microsoft.KeyVault(${kvRef}netsuite-file-cabinet-folder-id)'
        }
        { name: 'DOCUSIGN_ACCOUNT_ID', value: '@Microsoft.KeyVault(${kvRef}docusign-account-id)' }
        { name: 'DOCUSIGN_INTEGRATION_KEY', value: '@Microsoft.KeyVault(${kvRef}docusign-integration-key)' }
        { name: 'DOCUSIGN_USER_ID', value: '@Microsoft.KeyVault(${kvRef}docusign-user-id)' }
        { name: 'DOCUSIGN_PRIVATE_KEY', value: '@Microsoft.KeyVault(${kvRef}docusign-private-key)' }
        { name: 'DOCUSIGN_NDA_TEMPLATE_ID', value: '@Microsoft.KeyVault(${kvRef}docusign-nda-template-id)' }
        { name: 'DOCUSIGN_HMAC_SECRET', value: '@Microsoft.KeyVault(${kvRef}docusign-hmac-secret)' }
      ]
    }
  }
}

// Worker
resource workerApp 'Microsoft.Web/sites@2023-01-01' = {
  name: workerAppName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      appCommandLine: 'node src/workers/onboarding-worker.js'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: [
        // Plain values
        { name: 'NODE_ENV', value: 'production' }
        { name: 'AZURE_BLOB_CONTAINER', value: 'reseller-docs' }
        { name: 'AZURE_SERVICE_BUS_QUEUE_NAME', value: 'onboarding-jobs' }
        { name: 'ACROBAT_API_BASE_URL', value: 'https://api.na4.adobesign.com' }
        { name: 'DOCUSIGN_BASE_PATH', value: docusignBasePath }
        { name: 'PCS_OPS_EMAIL', value: pcsOpsEmail }
        { name: 'PCS_LEGAL_EMAIL', value: pcsLegalEmail }
        { name: 'PCS_LEGAL_NAME', value: pcsLegalName }
        { name: 'SENDGRID_FROM_EMAIL', value: 'resellers@pcsww.com' }
        { name: 'SENDGRID_FROM_NAME', value: 'PCS Partner Program' }
        // Key Vault references
        { name: 'DATABASE_URL', value: '@Microsoft.KeyVault(${kvRef}database-url)' }
        { name: 'AZURE_STORAGE_CONNECTION_STRING', value: '@Microsoft.KeyVault(${kvRef}storage-connection-string)' }
        {
          name: 'AZURE_SERVICE_BUS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(${kvRef}servicebus-connection-string)'
        }
        { name: 'JWT_SECRET', value: '@Microsoft.KeyVault(${kvRef}jwt-secret)' }
        { name: 'SENDGRID_API_KEY', value: '@Microsoft.KeyVault(${kvRef}sendgrid-api-key)' }
        { name: 'SENDGRID_TEMPLATE_WELCOME', value: '@Microsoft.KeyVault(${kvRef}sendgrid-template-welcome)' }
        {
          name: 'SENDGRID_TEMPLATE_INTERNAL_ALERT'
          value: '@Microsoft.KeyVault(${kvRef}sendgrid-template-internal-alert)'
        }
        { name: 'ACROBAT_CLIENT_ID', value: '@Microsoft.KeyVault(${kvRef}acrobat-client-id)' }
        { name: 'ACROBAT_CLIENT_SECRET', value: '@Microsoft.KeyVault(${kvRef}acrobat-client-secret)' }
        { name: 'ACROBAT_REFRESH_TOKEN', value: '@Microsoft.KeyVault(${kvRef}acrobat-refresh-token)' }
        { name: 'ACROBAT_NDA_TEMPLATE_ID', value: '@Microsoft.KeyVault(${kvRef}acrobat-nda-template-id)' }
        { name: 'NETSUITE_ACCOUNT_ID', value: '@Microsoft.KeyVault(${kvRef}netsuite-account-id)' }
        { name: 'NETSUITE_CONSUMER_KEY', value: '@Microsoft.KeyVault(${kvRef}netsuite-consumer-key)' }
        { name: 'NETSUITE_CONSUMER_SECRET', value: '@Microsoft.KeyVault(${kvRef}netsuite-consumer-secret)' }
        { name: 'NETSUITE_TOKEN_ID', value: '@Microsoft.KeyVault(${kvRef}netsuite-token-id)' }
        { name: 'NETSUITE_TOKEN_SECRET', value: '@Microsoft.KeyVault(${kvRef}netsuite-token-secret)' }
        { name: 'NETSUITE_SUBSIDIARY_ID', value: '@Microsoft.KeyVault(${kvRef}netsuite-subsidiary-id)' }
        { name: 'NETSUITE_FINANCE_EMPLOYEE_ID', value: '@Microsoft.KeyVault(${kvRef}netsuite-finance-employee-id)' }
        { name: 'NETSUITE_LEGAL_EMPLOYEE_ID', value: '@Microsoft.KeyVault(${kvRef}netsuite-legal-employee-id)' }
        {
          name: 'NETSUITE_FILE_CABINET_FOLDER_ID'
          value: '@Microsoft.KeyVault(${kvRef}netsuite-file-cabinet-folder-id)'
        }
        { name: 'DOCUSIGN_ACCOUNT_ID', value: '@Microsoft.KeyVault(${kvRef}docusign-account-id)' }
        { name: 'DOCUSIGN_INTEGRATION_KEY', value: '@Microsoft.KeyVault(${kvRef}docusign-integration-key)' }
        { name: 'DOCUSIGN_USER_ID', value: '@Microsoft.KeyVault(${kvRef}docusign-user-id)' }
        { name: 'DOCUSIGN_PRIVATE_KEY', value: '@Microsoft.KeyVault(${kvRef}docusign-private-key)' }
        { name: 'DOCUSIGN_NDA_TEMPLATE_ID', value: '@Microsoft.KeyVault(${kvRef}docusign-nda-template-id)' }
        { name: 'DOCUSIGN_HMAC_SECRET', value: '@Microsoft.KeyVault(${kvRef}docusign-hmac-secret)' }
      ]
    }
  }
}

// VNet Integration — routes all outbound traffic from the App Services through
// the VNet so they can reach the private PostgreSQL server. Production only.
resource apiVnetIntegration 'Microsoft.Web/sites/networkConfig@2023-01-01' = if (enablePrivateNetworking) {
  parent: apiApp
  name: 'virtualNetwork'
  properties: {
    subnetResourceId: appServiceSubnetId
    swiftSupported: true
  }
}

resource workerVnetIntegration 'Microsoft.Web/sites/networkConfig@2023-01-01' = if (enablePrivateNetworking) {
  parent: workerApp
  name: 'virtualNetwork'
  properties: {
    subnetResourceId: appServiceSubnetId
    swiftSupported: true
  }
}

// Key Vault access
// Grants both App Services the Key Vault Secrets User role so they can resolve
// the Key Vault References in their app settings at startup.
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource apiKvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, apiApp.id, kvSecretsUserRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: apiApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource workerKvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, workerApp.id, kvSecretsUserRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: workerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output apiAppHostname string = apiApp.properties.defaultHostName
output workerAppHostname string = workerApp.properties.defaultHostName
output staticWebAppHostname string = staticWebApp.properties.defaultHostname
