/*
    @Service name       : Handler,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 33
*/

// Require dependencies
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var servicePath = 'Handler';

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
    var reqDBInstance = require('../../../torus-references/instance/DBInstance');
    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Svc_Handler';

    reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
        reqDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
            reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
            objEvents.emit('EventAfterInit');
        });
    })

    // reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
    //         objEvents.emit('EventAfterInit');
    //     }
    // });

    function AfterInitDBListener() {
        var arrRoutes = [];

        var reqPing = require('./routes/Ping');
        var reqGetWFSelect = require('./routes/GetWFSelect');
        var reqChangeStatus = require('./routes/ChangeStatus');
        var reqChangeDataClass = require('./routes/ChangeDataClass');
        var reqShareTransaction = require('./routes/ShareTransaction');
        var reqDeleteItem = require('./routes/DeleteItem');
        var reqGetDpsSTS = require('./routes/GetDpsSTS');
        var reqBindSystems = require('./routes/BindSystems');
        var reqBindUsers = require('./routes/BindUsers');
        var reqDpsTable = require('./routes/DpsTable');
        var reqGetSharingWindowInfo = require('./routes/GetSharingWindowInfo');
        var reqDeleteContent = require('./routes/DeleteContent');
        var reqGetSTPComments = require('./routes/GetSTPComments');
        var reqUnshareTransaction = require('./routes/UnshareTransaction');
        var reqGetContentWindowInfo = require('./routes/GetContentWindowInfo');
        var reqSaveAccessTimeLog = require('./routes/SaveAccessTimeLog');
        var reqDpsPlatformTbl = require('./routes/DpsPlatformTbl');
        var reqAddSearchTag = require('./routes/AddSearchTag');
        var reqGetSolrSearchResult = require('./routes/GetSolrSearchResult');
        var reqBindAttachmentCategory = require('./routes/BindAttachmentCategory');
        var reqSaveMail = require('./routes/SaveMail');
        var reqViewDMSFiles = require('./routes/Sharepoint/ViewDMSFiles');
        var reqUpdateSharepointUser = require('./routes/Sharepoint/UpdateSharepointUser');
        var reqGetSharepointUser = require('./routes/Sharepoint/GetSharepointUser');
        var reqLoadSharepointdocument = require('./routes/Sharepoint/LoadSharepointdocument');
        var reqUploadFiles = require('./routes/Sharepoint/UploadFiles');
        var reqLockItems = require('./routes/LockItems');
        var reqUnLockItems = require('./routes/UnLockItems');
        var reqDoEmlImport = require('./routes/DoEmlImport');
        var reqDeletesharepointdocument = require('./routes/Sharepoint/Deletesharepointdocument');
        var reqLoadOrphanFiles = require('./routes/LoadOrphanFiles');
        var reqViewDMSNlicFiles = require('./routes/ViewDMSNlicFiles');
        var reqAttachDetachProcess = require('./routes/AttachDetachProcess');
        var reqUploadNlicFiles = require('./routes/UploadNlicFiles');
        var reqCallExternalApi = require('./routes/CallExternalApi')
        var reqSaveContent = require('./routes/SaveContent');
        var reqGetDpsDSTSTS = require('./routes/GetDpsDSTSTS');
        var reqGetDynamicJson = require('./routes/GetDynamicuiJSONData')
        var reqBindFromBlockchain = require('./routes/BindFromBlockchain');

        arrRoutes.push(reqGetDynamicJson);
        arrRoutes.push(reqPing);
        arrRoutes.push(reqGetWFSelect);
        arrRoutes.push(reqChangeStatus);
        arrRoutes.push(reqChangeDataClass);
        arrRoutes.push(reqShareTransaction);
        arrRoutes.push(reqDeleteItem);
        arrRoutes.push(reqGetSharingWindowInfo);
        arrRoutes.push(reqDeleteContent);
        arrRoutes.push(reqGetContentWindowInfo);
        arrRoutes.push(reqGetSTPComments);
        arrRoutes.push(reqUnshareTransaction);
        arrRoutes.push(reqSaveAccessTimeLog);
        arrRoutes.push(reqDpsPlatformTbl);
        arrRoutes.push(reqAddSearchTag);
        arrRoutes.push(reqGetDpsSTS);
        arrRoutes.push(reqBindSystems);
        arrRoutes.push(reqBindUsers);
        arrRoutes.push(reqDpsTable);
        arrRoutes.push(reqGetSolrSearchResult);
        arrRoutes.push(reqBindAttachmentCategory);
        arrRoutes.push(reqSaveMail);
        arrRoutes.push(reqViewDMSFiles);
        arrRoutes.push(reqUpdateSharepointUser);
        arrRoutes.push(reqGetSharepointUser);
        arrRoutes.push(reqLoadSharepointdocument);
        arrRoutes.push(reqUploadFiles);
        arrRoutes.push(reqLockItems);
        arrRoutes.push(reqUnLockItems);
        arrRoutes.push(reqDoEmlImport);
        arrRoutes.push(reqDeletesharepointdocument);
        arrRoutes.push(reqLoadOrphanFiles);
        arrRoutes.push(reqViewDMSNlicFiles);
        arrRoutes.push(reqAttachDetachProcess);
        arrRoutes.push(reqUploadNlicFiles);
        arrRoutes.push(reqSaveContent);
        arrRoutes.push(reqGetDpsDSTSTS);
        arrRoutes.push(reqCallExternalApi);
        arrRoutes.push(reqBindFromBlockchain);

        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}
/******** End of File *******/