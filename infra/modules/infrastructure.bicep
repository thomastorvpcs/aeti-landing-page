param location string
param dbLocation string
param keyVaultName string
param storageAccountName string
param serviceBusNamespaceName string
param dbServerName string
param dbSkuName string
param dbSkuTier string
param geoRedundantBackup bool

// When true, PostgreSQL is deployed into the VNet with no public endpoint.
// postgresSubnetId and privateDnsZoneId are required in that case.
param enablePrivateNetworking bool = false
param postgresSubnetId string = ''
param privateDnsZoneId string = ''

@secure()
param dbAdminPassword string

@secure()
param jwtSecret string

@secure()
param adminSecret string

var dbAdminUser = 'abtidbadmin'
var dbName = 'abti_onboarding'
var serviceBusQueueName = 'onboarding-jobs'
var serviceBusAuthRuleName = 'app-send-listen'

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
  }
}

// Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'reseller-docs'
  properties: {
    publicAccess: 'None'
  }
}

// Service Bus
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2021-11-01' = {
  name: serviceBusNamespaceName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
}

resource serviceBusQueue 'Microsoft.ServiceBus/namespaces/queues@2021-11-01' = {
  parent: serviceBusNamespace
  name: serviceBusQueueName
  properties: {
    lockDuration: 'PT1M' // 60s — matches current SQS visibility timeout
    maxDeliveryCount: 5 // matches current retry limit before dead-lettering
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
  }
}

// Queue-scoped policy with Send + Listen only; the application does not need Manage rights.
resource serviceBusQueueAuthRule 'Microsoft.ServiceBus/namespaces/queues/authorizationRules@2021-11-01' = {
  parent: serviceBusQueue
  name: serviceBusAuthRuleName
  properties: {
    rights: ['Send', 'Listen']
  }
}

// PostgreSQL Flexible Server
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2026-01-01-preview' = {
  name: dbServerName
  location: dbLocation
  sku: {
    name: dbSkuName
    tier: dbSkuTier
  }
  properties: {
    version: '18'
    administratorLogin: dbAdminUser
    administratorLoginPassword: dbAdminPassword
    storage: {
      storageSizeGB: 32
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: geoRedundantBackup ? 'Enabled' : 'Disabled'
    }
    network: enablePrivateNetworking ? {
      delegatedSubnetResourceId: postgresSubnetId
      privateDnsZoneArmResourceId: privateDnsZoneId
      publicNetworkAccess: 'Disabled'
    } : {
      publicNetworkAccess: 'Enabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
}

// Only created when private networking is off (dev/staging).
// Production uses VNet injection — the server has no public endpoint at all.
resource postgresAzureServicesFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2026-01-01-preview' = if (!enablePrivateNetworking) {
  parent: postgresServer
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2026-01-01-preview' = {
  parent: postgresServer
  name: dbName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Key Vault secrets provisioned by this deployment
// These four are derived from resources above and are populated automatically.
// The remaining secrets (listed at the bottom) must be added manually.

resource kvSecretStorageConnString 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'storage-connection-string'
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
  }
}

resource kvSecretServiceBusConnString 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'servicebus-connection-string'
  properties: {
    value: serviceBusQueueAuthRule.listKeys().primaryConnectionString
  }
}

resource kvSecretDatabaseUrl 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'database-url'
  properties: {
    value: 'postgresql://${dbAdminUser}:${dbAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}/${dbName}?sslmode=require'
  }
}

resource kvSecretJwtSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jwt-secret'
  properties: { value: jwtSecret }
}

resource kvSecretAdminSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'admin-secret'
  properties: { value: adminSecret }
}

// Secrets that must be added to Key Vault manually after provisioning
// The App Services will fail to resolve Key Vault References until these exist.
// Add each with: az keyvault secret set --vault-name abti-kv --name <name> --value <value>
//
// SendGrid
//   sendgrid-api-key
//   sendgrid-template-welcome
//   sendgrid-template-internal-alert
//
// Acrobat Sign
//   acrobat-client-id
//   acrobat-client-secret
//   acrobat-refresh-token
//   acrobat-nda-template-id
//
// NetSuite
//   netsuite-account-id
//   netsuite-consumer-key
//   netsuite-consumer-secret
//   netsuite-token-id
//   netsuite-token-secret
//   netsuite-subsidiary-id
//   netsuite-finance-employee-id
//   netsuite-legal-employee-id
//   netsuite-file-cabinet-folder-id
//
// DocuSign (legacy signing path)
//   docusign-account-id
//   docusign-integration-key
//   docusign-user-id
//   docusign-private-key          (RSA key — store as single line, use \n for newlines)
//   docusign-nda-template-id
//   docusign-hmac-secret

output keyVaultUri string = keyVault.properties.vaultUri
output dbServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
