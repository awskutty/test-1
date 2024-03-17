/* @LAST_ERROR_CODE: ERR_ATMT_DATA_PRODUCER_APP_0002 */

try {
    var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
    var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
    var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
    var reqProducer = require('./routes/AtmtDataProducer');
    var serviceName = 'AtmtDataProducer';
    var reqAsync = require('async');
    var logFilePath = 'bgprocess/producer/atmt-dataproducer';
    var objLogInfo = {};

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
            // Replace the dead worker, we're not sentimental
            reqInstanceHelper.PrintWarn(serviceName, 'Worker %d died :(', worker.id, objLogInfo);
            reqCluster.fork();
        });
        // Code to run if we're in a worker process
    } else {
        var reqEvents = require('events');
        var reqAppHelper = require('../../../../torus-references/instance/AppHelper');

        var objEvents = new reqEvents();
        objEvents.on('EventAfterInit', AfterInitDBListener);
        process.title = 'Torus_Bg_AtmtDataProducer';

        reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
            reqDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
                reqInstanceHelper.PrintInfo(serviceName, 'Instances loaded successfully.', null);
                objEvents.emit('EventAfterInit');
            });
        })

        function AfterInitDBListener() {
            try {
                var GetTenantTimezoneInfoReqObj = {
                    objLogInfo: objLogInfo
                };
                reqInstanceHelper.GetTenantTimezoneInfo(GetTenantTimezoneInfoReqObj, function (GetTenantTimezoneInfoStatus) {
                    if (GetTenantTimezoneInfoStatus) {
                        InittiateProducerSvc();
                    } else {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_ATMT_DATA_PRODUCER_APP_0001', 'Error While Getting Timezone Informations based on Tenant', '');
                        return;
                    }
                });


                // InittiateProducerSvc(); // For Development

                function InittiateProducerSvc() {
                    try {
                        var GetAllUniqueTranDBKeysReqObj = {
                            objLogInfo: objLogInfo
                        };

                        reqInstanceHelper.GetAllUniqueTranDBKeys(GetAllUniqueTranDBKeysReqObj, function (error, arrRoutingKeys) {

                            reqAsync.forEachOfSeries(arrRoutingKeys, function (eachTranDBKey, i, nextTranDBKey) {
                                var headers = {
                                    routingkey: eachTranDBKey,
                                    LOG_INFO: JSON.stringify(GetObjLogInfo())
                                };
                                var jsonToSend = {
                                    headers: headers,
                                    SERVICE_NAME: serviceName
                                };

                                // eachTranDBKey | 'TRANDB~CLT-1304~APP-109~TNT-0~ENV-DEV'
                                reqProducer.ProduceWithTranDBKey(jsonToSend, function () {
                                    nextTranDBKey();
                                });

                            }, function () {
                                reqInstanceHelper.PrintInfo(serviceName, 'All Threads are started successfully', objLogInfo);
                                    // this is for check service running
                                    var arrRoutes = [];
                                    var reqPing = require('./routes/Ping');
                                    arrRoutes.push(reqPing);
                                    reqAppHelper.StartService(serviceName, arrRoutes, __dirname);
                            });
                        })
                    } catch (error) {

                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_ATMT_DATA_PRODUCER_APP_0002', 'Catch error in InittiateProducerSvc()', error);
                    }
                }



                function GetObjLogInfo() {
                    try {
                        return reqLogWriter.GetLogInfo('ATMT_DATA_PRODUCER', 'ATMT_DATA_PRODUCER_PROCESS', 'ATMT_DATA_PRODUCER_ACTION', logFilePath);
                    } catch (error) {
                        return {};
                    }
                }
                
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, error, '', objLogInfo);
            }
        }
    }

} catch (error) {
    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_ATMT_DATA_PRODUCER_APP_0000', 'Catch Error in Service Startup', error);
}