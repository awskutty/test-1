/*
    @Service name       : Exchange,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 4
    @Used Redis DBs     : 3[validating Files in the Concurrency API Call], 7[Maintaining the ex_header_files - file names]
*/

// Require dependencies
var refPath = '../../../torus-references/'
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../torus-references/instance/DBInstance');
var reqHashTable = require('jshashtable');

var servicePath = 'Exchange';

// Global Variable Declaration 
global.ht_exg_ftp_file_names = new reqHashTable();
global.ht_exg_ftp_download_process = new reqHashTable();
global.ht_exg_DB_fail_process = new reqHashTable(); // For Upload Process
global.ht_exg_Down_Prct_To_Null_process = new reqHashTable(); // For Download Process
global.ht_exg_down_update_prct_to_null_process = new reqHashTable(); // For Only Update in Download Process
global.Exg_Down_DB_Insert_Failed_prct_ID = []; // Array Contains - ['1','2'...]
global.Exg_Download_Need_Prct_Null_Process = false;
global.Exg_Update_Need_Prct_Null_Process = false; // Used in ExgUpdateAutomation API
global.Exg_Download_Need_Prct_Null_Process_1 = false;
global.Exg_Download_Need_Prct_Null_Process_2 = false;
global.Exg_Download_Need_Prct_Null_Process_3 = false;
global.Exg_Download_Need_Prct_Null_Process_4 = false;
// For File Download Process Only
global.exgFileDownloadOnly = new reqHashTable();
global.Exg_File_Download_Only = false;

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
    process.title = 'Torus_Svc_Exchange';
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
        var temp = require('./routes/temp');
        // var loadExchangeGateway = require('./routes/LoadExchangeGateway');
        //  var loadExchangeSetting = require('./routes/LoadExchangeSetting');
        var exportFile = require('./routes/ExportFile');
        var importFile = require('./routes/ImportFile');
        var UploadFile = require('./routes/UploadFile');
        var GetFFGfromSystemId = require('./routes/GetFFGfromSystemId');
        var saveGateways = require('./routes/SaveGateways');
        var saveSysLink = require('./routes/SaveSysLink');
        var ExgDownloadAutomation = require('./routes/ExgDownloadAutomation');
        var ExgImportDownload = require('./routes/ExgImportDownload');
        var DeleteSysLinkGateways = require('./routes/DeleteSysLinkGateways');
        var SaveSysGateways = require('./routes/SaveSysGateways');
        var viewCreatedFiles = require('./routes/ViewCreatedFiles');
        var importFileFromPath = require('./routes/ImportFileFromPath');
        var ViewDownloadedFiles = require('./routes/ViewDownloadedFiles');
        var GetGatewayandFFG = require('./routes/GetGatewayandFFG');
        var ViewFileForDownload = require('./routes/ViewFileForDownload');
        var DownloadAttachment = require('./routes/DownloadAttachment');
        var SaveExgMenuInfo = require('./routes/SaveExgMenuInfo');
        var GetEligibleFileForDownload = require('./routes/GetEligibleFileForDownload');
        var uploadCreatedFiles = require('./routes/uploadCreatedFiles');
        var ExgGlobalVariables = require('./routes/ExgGlobalVariables');
        var ExgUpdateAutomation = require('./routes/ExgUpdateAutomation');
        var ExgDeleteFTPFiles = require('./routes/ExgDeleteFTPFiles');
        var ViewUpdateFailedFiles = require('./routes/ViewUpdateFailedFiles');
        var GetExgLogs = require('./routes/GetExgLogs');
        var DownloadToLocal = require('./routes/DownloadToLocal')
        var DeleteDownloadedFiles =require('./routes/DeleteDownloadedFiles');


        arrRoutes.push(reqPing);
        arrRoutes.push(temp);
        //  arrRoutes.push(loadExchangeGateway);
        // arrRoutes.push(loadExchangeSetting);
        arrRoutes.push(exportFile);
        arrRoutes.push(importFile);
        arrRoutes.push(GetFFGfromSystemId);
        arrRoutes.push(saveGateways);
        arrRoutes.push(saveSysLink);
        arrRoutes.push(ExgDownloadAutomation);
        arrRoutes.push(ExgImportDownload);
        arrRoutes.push(DeleteSysLinkGateways);
        arrRoutes.push(SaveSysGateways);
        arrRoutes.push(viewCreatedFiles);
        arrRoutes.push(importFileFromPath);
        arrRoutes.push(UploadFile);
        arrRoutes.push(ViewDownloadedFiles);
        arrRoutes.push(GetGatewayandFFG);
        arrRoutes.push(ViewFileForDownload);
        arrRoutes.push(DownloadAttachment);
        arrRoutes.push(SaveExgMenuInfo);
        arrRoutes.push(GetEligibleFileForDownload);
        arrRoutes.push(uploadCreatedFiles);
        arrRoutes.push(ExgGlobalVariables);
        arrRoutes.push(ExgUpdateAutomation);
        arrRoutes.push(ExgDeleteFTPFiles);
        arrRoutes.push(ViewUpdateFailedFiles);
        arrRoutes.push(GetExgLogs);
        arrRoutes.push(DownloadToLocal)
        arrRoutes.push(DeleteDownloadedFiles);

        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}
/******** End of File *******/