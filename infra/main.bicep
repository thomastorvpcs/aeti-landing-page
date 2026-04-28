targetScope = 'resourceGroup'

param location string = 'eastus2'
param staticSiteLocation string = 'eastus2'

// Resource names
param keyVaultName string
param storageAccountName string
param serviceBusNamespaceName string
param dbServerName string
param appServicePlanName string
param apiAppName string
param workerAppName string
param staticWebAppName string

// Private networking — set true for production (requires P1v3+ App Service Plan)
param enablePrivateNetworking bool = false
param vnetName string = ''

// Environment-specific values
param appServicePlanSku string
param staticWebAppSku string
param dbSkuName string
param dbSkuTier string
param geoRedundantBackup bool
param docusignBasePath string

// Organizational config
param pcsOpsEmail string
param pcsLegalEmail string
param pcsLegalName string = 'PCS Legal'

// Secrets
@secure()
param dbAdminPassword string

@secure()
param jwtSecret string

@secure()
param adminSecret string

// Resource group
var rg = resourceGroup()

// Network: VNet, subnets, private DNS zone — production only.
// When enabled, PostgreSQL is deployed with no public endpoint and App Services
// connect to it through VNet Integration.
module network './modules/network.bicep' = if (enablePrivateNetworking) {
  name: 'network'
  scope: rg
  params: {
    location: location
    vnetName: vnetName
    dbServerName: dbServerName
  }
}

// Infrastructure: Key Vault, Storage, Service Bus, PostgreSQL
module infrastructure './modules/infrastructure.bicep' = {
  name: 'infrastructure'
  scope: rg
  params: {
    location: location

    keyVaultName: keyVaultName
    storageAccountName: storageAccountName
    serviceBusNamespaceName: serviceBusNamespaceName
    dbServerName: dbServerName
    dbSkuName: dbSkuName
    dbSkuTier: dbSkuTier
    geoRedundantBackup: geoRedundantBackup
    dbAdminPassword: dbAdminPassword
    jwtSecret: jwtSecret
    adminSecret: adminSecret
    enablePrivateNetworking: enablePrivateNetworking
    postgresSubnetId: enablePrivateNetworking ? network!.outputs.postgresSubnetId : ''
    privateDnsZoneId: enablePrivateNetworking ? network!.outputs.privateDnsZoneId : ''
  }
}

// Compute: App Service Plan, API, Worker, Static Web App
// dependsOn ensures Key Vault and all provisioned secrets exist before the
// App Services start and attempt to resolve their Key Vault References.
module compute './modules/compute.bicep' = {
  name: 'compute'
  scope: rg
  dependsOn: [infrastructure]
  params: {
    location: location
    staticSiteLocation: staticSiteLocation
    appServicePlanName: appServicePlanName
    appServicePlanSku: appServicePlanSku
    apiAppName: apiAppName
    workerAppName: workerAppName
    staticWebAppName: staticWebAppName
    staticWebAppSku: staticWebAppSku
    keyVaultName: keyVaultName
    pcsOpsEmail: pcsOpsEmail
    pcsLegalEmail: pcsLegalEmail
    pcsLegalName: pcsLegalName
    docusignBasePath: docusignBasePath
    enablePrivateNetworking: enablePrivateNetworking
    appServiceSubnetId: enablePrivateNetworking ? network!.outputs.appServiceSubnetId : ''
  }
}

// Outputs
output apiUrl string = 'https://${compute.outputs.apiAppHostname}'
output workerUrl string = 'https://${compute.outputs.workerAppHostname}'
output frontendUrl string = 'https://${compute.outputs.staticWebAppHostname}'
output keyVaultUri string = infrastructure.outputs.keyVaultUri
output dbServerFqdn string = infrastructure.outputs.dbServerFqdn
