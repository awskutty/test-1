/*
    @Service name       : Audit,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 7
*/

// Require dependencies
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../torus-references/instance/DBInstance');
var servicePath = 'Audit';

// Include the cluster module
var reqCluster = require('cluster');
// Code to run if we're in the master process
if (!reqCluster.isMaster) {
    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;
    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        reqCluster.fork();
    }
    // Listen for dying workers
    reqCluster.on('exit', function (worker) {
        // Replace the dead worker, we're not sentimental
        console.log('Worker %d died :(', worker.id);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqEvents = require('events');
    var reqAppHelper = require('../../../torus-references/instance/AppHelper');

    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Svc_Audit';
    reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
        reqDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
            reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
            objEvents.emit('EventAfterInit');
        });
    })

    function AfterInitDBListener() {
        var arrRoutes = [];
        var reqAddConnector = require('./routes/AddConnector');
        var reqGetConnectorList = require('./routes/GetConnectorList');
        var reqStartConnector = require('./routes/StartConnector');
        var reqStartAllConnector = require('./routes/StartAllConnector');
        var reqStopConnector = require('./routes/StopConnector');
        var reqStopAllConnector = require('./routes/StopAllConnector');
        var reqDeleteConnector = require('./routes/DeleteConnector');
        var reqGetAuditProcessDetails = require('./routes/GetAuditProcessDetails');
        var reqGetExchangeDetails = require('./routes/GetExchangeDetails');
        var reqGetAtmtData = require('./routes/GetAtmtDetails');
        var reqGetdttypes = require('./routes/Getdttypes');
        var reqTransactionDataSearch = require('./routes/TransactionDataSearch');
        var reqGetAuditVersionInfo = require('./routes/GetAuditVersionInfo');
        var reqGetAuditLogInfo = require('./routes/GetAuditLogInfo');
        var reqGetAuditGroupByInfo = require('./routes/GetAuditGroupByInfo');
        var reqPrepareConnectorMetrics = require('./routes/PrepareConnectorMetrics');
        var reqPing = require('./routes/Ping');
        var reqGetHSTFailureSummary = require('./routes/GetHSTFailureSummary');
        var reqGetReconcilationData = require('./routes/GetReconcilationData');
        var reqExportPdf = require('./routes/ExportPdf');
        var reqGetFxTable = require('./routes/Getfxtable');
        var reqGetFxTableDetails = require('./routes/Getfxtabledetails')
        var reqExportExcel = require('./routes/ExportExcel')



        arrRoutes.push(reqGetHSTFailureSummary);
        arrRoutes.push(reqGetReconcilationData);
        arrRoutes.push(reqGetConnectorList);
        arrRoutes.push(reqAddConnector);
        arrRoutes.push(reqStartConnector);
        arrRoutes.push(reqStartAllConnector);
        arrRoutes.push(reqStopConnector);
        arrRoutes.push(reqStopAllConnector);
        arrRoutes.push(reqDeleteConnector);
        arrRoutes.push(reqGetAuditProcessDetails);
        arrRoutes.push(reqGetExchangeDetails);
        arrRoutes.push(reqGetAtmtData);
        arrRoutes.push(reqGetdttypes);
        arrRoutes.push(reqTransactionDataSearch);
        arrRoutes.push(reqGetAuditVersionInfo);
        arrRoutes.push(reqGetAuditLogInfo);
        arrRoutes.push(reqGetAuditGroupByInfo);
        arrRoutes.push(reqPrepareConnectorMetrics);
        arrRoutes.push(reqPing);
        arrRoutes.push(reqExportPdf);
        arrRoutes.push(reqGetFxTable);
        arrRoutes.push(reqGetFxTableDetails);
        arrRoutes.push(reqExportExcel);

        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
        var reqGetConnectorStatus = require('./routes/GetConnectorStatus');
        reqGetConnectorStatus.ProduceWithAllTranDBKeys();

    }
}
/******** End of File *******/