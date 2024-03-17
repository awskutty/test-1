/*  Created BY      :Udhaya
    Created Date    :24-jun-2016
    pupose          :LoadClusters in wp  
    @Api_Name : /LoadClusters,
    @Description: To LoadClusters
    @Last_Error_code:ERR-MIN-50903
      */

// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLINQ = require(modPath + "node-linq").LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');

//Global variable Initialization
var strServiceName = "LoadClusterSystem";


//host the method to express
router.post('/LoadClusterSystem', function (appRequest, appResponse) {
    var objLogInfo;
    var params = appRequest.body.PARAMS;
    if (params != '') {
        var ISSearch = params.IsSearch;
        var Desc = params.SDesc
    }
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
            objLogInfo.HANDLER_CODE = 'LoadClusterSystem';
            objLogInfo.PROCESS = 'LoadClusters-MiniGoverner';
            objLogInfo.ACTION_DESC = 'LoadClusterSystem';
            var mHeaders = appRequest.headers;



            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                reqInstanceHelper.PrintInfo(strServiceName, 'Cassandra Connection Initiated Successfully', objLogInfo);
                var mClient = pCltClient;
                var strAppID = sessionInfo.APP_ID;
                var strClientID = sessionInfo.CLIENT_ID;

                //Function call
                reqInstanceHelper.PrintInfo(strServiceName, 'Calling LoadClusters Function', objLogInfo);
                LoadClustersSys();

                //Prepare Function
                function LoadClustersSys() {
                    var totalObjClustersSys = {};
                    var arrClustersSys = [];
                    reqInstanceHelper.PrintInfo(strServiceName, 'app_system_to_system', objLogInfo);
                    reqFXDBInstance.GetTableFromFXDB(mClient, 'app_system_to_system', [], {
                        'app_id': strAppID
                    }, objLogInfo, function (pError, pResult) {
                        try {
                            if (pError) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50901', 'Error in Querying app_system_to_system table', pError, '', '');

                            } else {
                                reqInstanceHelper.PrintInfo(strServiceName, 'Got result app_system_to_system from table', objLogInfo);
                                var APSTSrows = pResult.rows
                                if (ISSearch != undefined) {
                                    APSTSrows = new reqLINQ(APSTSrows)
                                        .Where(function (item) {
                                            return item.s_description.toUpperCase().startsWith(Desc.toUpperCase())
                                        }).ToArray();
                                }
                                reqFXDBInstance.GetTableFromFXDB(mClient, 'systems', ['s_description', 's_id'], {
                                }, objLogInfo, function (perr, pRes) {
                                    if (perr) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50901', 'Error in Querying app_system_to_system table', perr, '', '');
                                    } else {
                                        var SysRes = pRes.rows;
                                        reqFXDBInstance.GetTableFromFXDB(mClient, 'clusters', ['cluster_code', 'cluster_name'], {
                                            'client_id': strClientID
                                        }, objLogInfo, function (PErr, PResult) {
                                            var ClusterRows = PResult.rows

                                            for (var i = 0; i < APSTSrows.length; i++) {
                                                var objClusterSys = {};
                                                objClusterSys.CLUSTER_CODE = APSTSrows[i].cluster_code;
                                                objClusterSys.S_CODE = APSTSrows[i].s_code;
                                                objClusterSys.S_DESCRIPTION = APSTSrows[i].s_description;
                                                objClusterSys.S_ID = APSTSrows[i].s_id;
                                                objClusterSys.APPST_ID = APSTSrows[i].appst_id;
                                                objClusterSys.STS_ID = APSTSrows[i].sts_id;
                                                objClusterSys.ST_ID = APSTSrows[i].st_id;
                                                objClusterSys.APPSTS_ID = APSTSrows[i].appsts_id;
                                                objClusterSys.IS_ENABLED = APSTSrows[i].is_enabled;
                                                if (APSTSrows[i].is_enabled == '' || APSTSrows[i].is_enabled == null || APSTSrows[i].is_enabled == "Y") {
                                                    objClusterSys.Access = "Enabled"
                                                } else {
                                                    objClusterSys.Access = "Disabled"
                                                }
                                                for (j = 0; j < SysRes.length; j++) {
                                                    if (APSTSrows[i].parent_s_id == SysRes[j].s_id) {
                                                        objClusterSys.PARENT_S_DESC = SysRes[j].s_description;
                                                        objClusterSys.PARENT_SID = SysRes[j].s_id;
                                                        break;
                                                    } else {
                                                        objClusterSys.PARENT_S_DESC = '';
                                                        continue;
                                                    }
                                                }
                                                for (k = 0; k < ClusterRows.length; k++) {
                                                    if (APSTSrows[i].cluster_code == ClusterRows[k].cluster_code) {
                                                        objClusterSys.CLUSTER_DESC = ClusterRows[k].cluster_name
                                                        break
                                                    } else {
                                                        continue;
                                                    }
                                                }
                                                arrClustersSys.push(objClusterSys);
                                            }
                                            totalObjClustersSys.CLUS_SYSTEMS = arrClustersSys;
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, totalObjClustersSys, objLogInfo, '', '', '', '', '');
                                        })
                                    }
                                })
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50902', 'Error while Querying app_system_to_system table', error, '', '');
                            //errorHandler("ERR-FX-10315", "Error in LoadClusters function " + error)
                        }
                    })
                }
            });
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50903', 'Error while calling LoadClusters API function', error, '', '');
        //errorHandler("ERR-FX-10314", "Error in LoadClusters function " + error)
    }

    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });

})
module.exports = router;
//*******End of Serive*******//