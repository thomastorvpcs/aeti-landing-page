param location string
param keyVaultName string
param storageAccountName string
param serviceBusNamespaceName string
param dbServerName string
param dbSkuName string
param dbSkuTier string
param geoRedundantBackup bool
param vnetResourceGroup string
param vnetName string
param storagePrivateEndpointSubnetName string
param sqlPrivateEndpointSubnetName string

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

// var dnsZoneBase = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${vnetResourceGroup}/providers/Microsoft.Network/privateDnsZones'
// var blobDnsZoneId = '${dnsZoneBase}/privatelink.blob.core.windows.net'
// var postgresDnsZoneId = '${dnsZoneBase}/privatelink.postgres.database.azure.com'
// var kvDnsZoneId = '${dnsZoneBase}/privatelink.vaultcore.azure.net'

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' existing = {
  name: vnetName
  scope: resourceGroup(vnetResourceGroup)
}

resource storageSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' existing = {
  parent: vnet
  name: storagePrivateEndpointSubnetName
}

resource sqlSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' existing = {
  parent: vnet
  name: sqlPrivateEndpointSubnetName
}

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
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
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
// Private endpoints require Premium tier. This namespace stays on Standard; access is
// restricted at the application layer via connection strings stored in Key Vault.
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
  location: location
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
    network: {
      publicNetworkAccess: 'Disabled'
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

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2026-01-01-preview' = {
  parent: postgresServer
  name: dbName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Key Vault secrets provisioned by this deployment
// These are derived from resources above and are populated automatically.
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

// Private Endpoints

resource peStorageBlob 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'PE-${storageAccountName}-BLOB'
  location: location
  properties: {
    subnet: { id: storageSubnet.id }
    privateLinkServiceConnections: [
      {
        name: 'PE-${storageAccountName}-BLOB'
        properties: {
          privateLinkServiceId: storageAccount.id
          groupIds: ['blob']
        }
      }
    ]
  }
}

// resource peStorageBlobDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
//   parent: peStorageBlob
//   name: 'default'
//   properties: {
//     privateDnsZoneConfigs: [
//       {
//         name: 'blob'
//         properties: { privateDnsZoneId: blobDnsZoneId }
//       }
//     ]
//   }
// }

resource pePostgres 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'PE-${dbServerName}-SQL'
  location: location
  properties: {
    subnet: { id: sqlSubnet.id }
    privateLinkServiceConnections: [
      {
        name: 'PE-${dbServerName}-SQL'
        properties: {
          privateLinkServiceId: postgresServer.id
          groupIds: ['postgresqlServer']
        }
      }
    ]
  }
}

// resource pePostgresDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
//   parent: pePostgres
//   name: 'default'
//   properties: {
//     privateDnsZoneConfigs: [
//       {
//         name: 'postgres'
//         properties: { privateDnsZoneId: postgresDnsZoneId }
//       }
//     ]
//   }
// }

resource peKeyVault 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'PE-${keyVaultName}'
  location: location
  properties: {
    subnet: { id: storageSubnet.id }
    privateLinkServiceConnections: [
      {
        name: 'PE-${keyVaultName}'
        properties: {
          privateLinkServiceId: keyVault.id
          groupIds: ['vault']
        }
      }
    ]
  }
}

// resource peKeyVaultDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
//   parent: peKeyVault
//   name: 'default'
//   properties: {
//     privateDnsZoneConfigs: [
//       {
//         name: 'vault'
//         properties: { privateDnsZoneId: kvDnsZoneId }
//       }
//     ]
//   }
// }

output keyVaultUri string = keyVault.properties.vaultUri
output dbServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
