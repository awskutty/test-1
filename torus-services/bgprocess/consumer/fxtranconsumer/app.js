/****
  Descriptions - Node app.js file to start Fx Tran consumer service  
  @Last Error Code : 'ERR_FXTRAN_CONSUMER_APP_0003'
 ****/

// Require dependencies
var reqAsync = require('async');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var servicePath = 'FXTranConsumer';
var objLogInfo = {};

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
        reqInstanceHelper.PrintWarn(servicePath, 'Worker %d died :(' + worker.id, objLogInfo);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqEvents = require('events');
    var reqAppHelper = require('../../../../torus-references/instance/AppHelper');

    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Bg_FxTranConsumer';
    reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
        if (pResult == 'SUCCESS') {
            reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
            objEvents.emit('EventAfterInit');
        }
    });

    function AfterInitDBListener() {
        var reqConsumer = require('./routes/Consumer');
        var topic = 'PRF.hst_fx_table_data'; // For Postgrez DB
        var group = 'HST_FX_TABLE_DATA_GRP';
        var headers = {
            routingkey: 'clt-0~app-0~tnt-0~env-0'
        };
        var pOptionalParam = {};
        pOptionalParam.maxKafkaMsgCount = 100;
        pOptionalParam.SERVICE_NAME = servicePath;

        var GetTenantTimezoneInfoReqObj = {
            objLogInfo: objLogInfo
        };
        reqInstanceHelper.GetTenantTimezoneInfo(GetTenantTimezoneInfoReqObj, function (GetTenantTimezoneInfoStatus) {
            if (GetTenantTimezoneInfoStatus) {
                var GetAllUniqueTranDBKeysObj = { objLogInfo };
                reqInstanceHelper.GetAllUniqueTranDBKeys(GetAllUniqueTranDBKeysObj, function (error, arrUniqueTranDBKeys, isTenantMultiThreaded) {
                    if (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_FXTRAN_CONSUMER_APP_0001', 'Error in GetAllUniqueTranDBKeys()...', error);
                    } else if (isTenantMultiThreaded && !arrUniqueTranDBKeys.length) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_FXTRAN_CONSUMER_APP_0002', 'Tenant Multi Thread is Enabled in Redis Service Param. But There is No TRANDB keys, so Workers will not be Created...', '');
                    } else {
                        var kafkaTopics = [];
                        // Normal Case
                        kafkaTopics.push('PRF.HST_FX_TABLE_DATA');
                        if (isTenantMultiThreaded) {
                            for (let c = 0; c < arrUniqueTranDBKeys.length; c++) {
                                const TranDBKey = arrUniqueTranDBKeys[c];
                                var newTopic = topic + '_' + TranDBKey;
                                newTopic = newTopic.replace(/~/g, '_'); // If Replace is Not Done then It will not create a Kfka Topic
                                var oracleDBTopic = 'PRF.HST_FX_TABLE_DATA'; //For Oracle DB
                                oracleDBTopic = oracleDBTopic + '_' + TranDBKey;
                                oracleDBTopic = oracleDBTopic.replace(/~/g, '_'); // If Replace is Not Done then It will not create a Kfka Topic
                                kafkaTopics.push(newTopic);
                                kafkaTopics.push(oracleDBTopic);
                            }
                            reqInstanceHelper.PrintInfo(servicePath, '---------- Multi Threaded Consumer Instance Created ----------', objLogInfo);
                        } else {
                            
                            reqInstanceHelper.PrintInfo(servicePath, '---------- Single Threaded Consumer Instance Created ----------', objLogInfo);
                        }
                        pOptionalParam.kafkaTopics = kafkaTopics;
                        reqAppHelper.StartConsumer(servicePath, reqConsumer, topic, group, headers, pOptionalParam);
                    }
                });
            } else {
                reqInstanceHelper.PrintError(servicePath, objLogInfo, 'ERR_FXTRAN_CONSUMER_APP_0003', 'Error While Getting Timezone Informations based on Tenant', '');
                return;
            }
        });

        // this is for check service running
        var arrRoutes = [];
        var reqPing = require('./routes/Ping');
        arrRoutes.push(reqPing);
        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}
/******** End of File **********/