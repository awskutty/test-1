/*
    @Service name       : Archival,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 33
*/

// Require dependencies
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../torus-references/instance/DBInstance');
var servicePath = 'Archival';

// Include the cluster modules
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
        // 6Replace the dead worker, we're not sentimental
        console.log('Worker %d died :(', worker.id);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqEvents = require('events');
    var reqAppHelper = require('../../../torus-references/instance/AppHelper');

    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Svc_Archival';
    // reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
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

        var reqArchivalDeleteProcedure = require('./routes/ArchivalDeleteProcedure');
        var reqArchivalIndexProcedure = require('./routes/ArchivalIndexprocedure');
        var reqloadarsetup = require('./routes/ArchivalsetupLoad');
        var reqArchivalIndex = require('./routes/ArchivalsetupSave');
        var reqLoadDTInfo = require('./routes/LoadDTInfo');
        var reqPing = require('./routes/Ping');
        var reqsavestatictable = require('./routes/savestatictable');
        var reqDeleteStaticTable = require('./routes/DeleteStaticTable');
        var reqArchivalQueryLog = require('./routes/ArchivalQueryLog');
        var reqArchivalProcessQry = require('./routes/ArchivalProcessQuery');
        var reqDeleteArchivalSetup = require('./routes/DeleteArchivalSetup');
        var reqArchivalSetupMode = require('./routes/GetArchivalSetupMode');
        var reqClearSolrCore = require('./routes/ClearSolrCore');
        var reqArchivalProcess = require('./routes/ArchivalProcess');
        var reqDeleteLogData = require('./routes/DeleteLogData')

        arrRoutes.push(reqsavestatictable);
        arrRoutes.push(reqLoadDTInfo);
        arrRoutes.push(reqloadarsetup);
        arrRoutes.push(reqArchivalDeleteProcedure);
        arrRoutes.push(reqArchivalIndexProcedure);
        arrRoutes.push(reqArchivalIndex);
        arrRoutes.push(reqDeleteStaticTable);
        arrRoutes.push(reqArchivalQueryLog);
        arrRoutes.push(reqArchivalProcessQry);
        arrRoutes.push(reqDeleteArchivalSetup);
        arrRoutes.push(reqArchivalSetupMode);
        arrRoutes.push(reqClearSolrCore);
        arrRoutes.push(reqPing);
        arrRoutes.push(reqArchivalProcess);
        arrRoutes.push(reqDeleteLogData)


        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}
/******** End of File *******/