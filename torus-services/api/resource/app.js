/*
    @Service name       : Resource,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 12
*/

// Require dependencies
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../torus-references/instance/DBInstance');
var servicePath = 'Resource';

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
    process.title = 'Torus_Svc_Resource';
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

        var reqPing = require('./routes/Ping');
        var reqDownloadFile = require('./routes/DownloadFile');
        var reqSaveAnnotation = require('./routes/SaveAnnotation');
        var reqAnnotationCheckOut = require('./routes/AnnotationCheckOut');
        var reqAnnotationCheckIn = require('./routes/AnnotationCheckIn');
        var reqBindVersionAttachments = require('./routes/BindVersionAttachments');
        var reqSaveBurnMarkupToDB = require('./routes/SaveBurnMarkupToDB');
        var reqAddContent = require('./routes/AddContent');
        var reqLoadAttachment = require('./routes/LoadAttachment');
        var reqBindAttachment = require('./routes/BindAttachment');
        var reqAtmtVersioningRollback = require('./routes/AtmtVersioningRollback');
        var reqSaveEmlAttachment = require('./routes/SaveEmlAttachment');
        var CheckAtmtExistence = require('./routes/CheckAtmtExistence');
        var reqUpdateAttachment = require('./routes/UpdateAttachment');

        arrRoutes.push(reqPing);
        arrRoutes.push(reqDownloadFile);
        arrRoutes.push(reqSaveAnnotation);
        arrRoutes.push(reqAnnotationCheckOut);
        arrRoutes.push(reqAnnotationCheckIn);
        arrRoutes.push(reqBindVersionAttachments);
        arrRoutes.push(reqSaveBurnMarkupToDB);
        arrRoutes.push(reqAddContent);
        arrRoutes.push(reqLoadAttachment);
        arrRoutes.push(reqBindAttachment);
        arrRoutes.push(reqAtmtVersioningRollback);
        arrRoutes.push(reqSaveEmlAttachment);
        arrRoutes.push(CheckAtmtExistence);
        arrRoutes.push(reqUpdateAttachment);

        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}
/******** End of File *******/