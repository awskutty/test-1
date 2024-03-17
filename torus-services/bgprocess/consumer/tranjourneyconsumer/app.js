/*
 Descriptions - Node app.js file to start auditlog consumer service  
@Last Error Code : 'ERR_TRAN_JOURNEY_APP_0003'
Redis DB  8 is used for Starting a Single Consumer Instance
*/

try {
    // Require dependencies
    var reqAsync = require('async');
    var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
    var servicePath = 'TranJourneyConsumer';
    var objLogInfo = {};
    var reqOs = require('os');

    var containerName = reqOs.hostname();
    // Include the cluster module
    var reqCluster = require('cluster');
    // Code to run if we're in the master process
    if (!reqCluster.isMaster) {
        // Count the machine's CPUs
        var cpuCount = reqOs.cpus().length;
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
        process.title = 'Torus_Bg_TranJourneyConsumer';
        reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
            if (pResult == 'SUCCESS') {
                reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
                objEvents.emit('EventAfterInit');
            }
        });

        function AfterInitDBListener() {
            var reqConsumer = require('./routes/Consumer');
            var topic = 'TRAN_JOURNEY_DETAIL';
            var group = 'TRAN_JOURNEY_DETAIL_GRP';

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
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_TRAN_JOURNEY_APP_0001', 'Error in GetAllUniqueTranDBKeys()...', error);
                        } else if (isTenantMultiThreaded && !arrUniqueTranDBKeys.length) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_TRAN_JOURNEY_APP_0002', 'Tenant Multi Thread is Enabled in Redis Service Param. But There is No TRANDB keys, so Workers will not be Created...', '');
                        } else {
                            var kafkaTopics = [];
                            if (isTenantMultiThreaded) {
                                for (let c = 0; c < arrUniqueTranDBKeys.length; c++) {
                                    const TranDBKey = arrUniqueTranDBKeys[c];
                                    var newTopic = topic + '_' + TranDBKey;
                                    newTopic = newTopic.replace(/~/g, '_'); // If Replace is Not Done then It will not create a Kfka Topic
                                    kafkaTopics.push(newTopic);
                                }
                                reqInstanceHelper.PrintInfo(servicePath, '---------- Multi Threaded Consumer Instance Created ----------', objLogInfo);
                            } else {
                                // Normal Case
                                reqInstanceHelper.PrintInfo(servicePath, '---------- Single Threaded Consumer Instance Created ----------', objLogInfo);
                            }
                            pOptionalParam.kafkaTopics = kafkaTopics;
                            reqAppHelper.StartConsumer(servicePath, reqConsumer, topic, group, headers, pOptionalParam);
                        }
                    });
                } else {
                    reqInstanceHelper.PrintError(servicePath, objLogInfo, 'ERR_TRAN_JOURNEY_APP_0003', 'Error While Getting Timezone Informations based on Tenant', '');
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
} catch (error) {
    reqInstanceHelper.PrintError(servicePath, objLogInfo, 'ERR-TRAN-VERSION-CONSUMER-0001', 'Catch Error while starting TranVersionDetail Consumer Service...', error);
}