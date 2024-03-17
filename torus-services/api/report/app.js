/*
    @Service name       : Report,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 10
*/

// Require dependencies
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../torus-references/instance/DBInstance');
var servicePath = 'Report';

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
    process.title = 'Torus_Svc_Report';
    // reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
    //         //console.log('INFO : ', reqDateFormat(new Date(), 'yyyy-mm-dd hh:mm:ss'), servicePath, 'Instances loaded successfully.');
    //         objEvents.emit('EventAfterInit');
    //     }
    // });

    reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
        reqDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
            reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
            objEvents.emit('EventAfterInit');
        });
    })

    function AfterInitDBListener() {
        var arrRoutes = [];

        var reqPing = require('./routes/Ping');
        var reqLoadReport = require('./routes/LoadReport');
        var reqLoadReportParam = require('./routes/LoadReportParam');
        var reqLoadApplnReport = require('./routes/LoadApplnReport');
        var reqSearchReport = require('./routes/SearchReport');
        var reqLoadRptSharing = require('./routes/LoadRptSharing');
        var reqSaveAsPDF = require('./routes/SaveAsPDF');
        var reqSaveAsExcel = require('./routes/SaveAsExcel');
        var reqLoadRptShareValue = require('./routes/LoadRptShareValue');
        var reqSaveRptSharing = require('./routes/SaveRptSharing');
        var reqSaveRptInfo = require('./routes/saveReportInWp');
        var reqDeleteReport = require('./routes/DeleteReport');
        var reqSessionReport = require('./routes/getSessionParams');

        arrRoutes.push(reqPing);
        arrRoutes.push(reqLoadReport);
        arrRoutes.push(reqLoadReportParam);
        arrRoutes.push(reqLoadApplnReport);
        arrRoutes.push(reqSearchReport);
        arrRoutes.push(reqLoadRptSharing);
        arrRoutes.push(reqSaveAsPDF);
        arrRoutes.push(reqSaveAsExcel);
        arrRoutes.push(reqLoadRptShareValue);
        arrRoutes.push(reqSaveRptSharing);
        arrRoutes.push(reqSaveRptInfo);
        arrRoutes.push(reqDeleteReport);
        arrRoutes.push(reqSessionReport);

        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}
/******** End of File *******/