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
var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];


//Global variable Initialization
var strServiceName = "LoadClusters";

//Prepare Query
const CLUSTER = 'select client_id,cluster_code,cluster_name from clusters where client_id=? allow filtering';

//host the method to express
router.post('/LoadClusters', function (appRequest, appResponse) {
    var objLogInfo;
    var params = appRequest.body.PARAMS;
    if (params != '') {
        var ISSearch = params.IsSearch;
        var Desc = params.clusterDesc
    }
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
            objLogInfo.HANDLER_CODE = 'LoadClusters';
            objLogInfo.PROCESS = 'LoadClusters-MiniGoverner';
            objLogInfo.ACTION_DESC = 'LoadClusters';
            var mHeaders = appRequest.headers;



            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                reqInstanceHelper.PrintInfo(strServiceName, 'Cassandra Connection Initiated Successfully', objLogInfo);
                var mClient = pCltClient;
                var strAppID = sessionInfo.APP_ID;
                var strClientID = sessionInfo.CLIENT_ID;   
                var strTntId = sessionInfo.TENANT_ID;
                var sid = sessionInfo.S_ID;
                var whereCond = {};
                var table_name = 'clusters'
                var columns = ['client_id', 'cluster_code', 'cluster_name'];    

                //Function call
                reqInstanceHelper.PrintInfo(strServiceName, 'Calling LoadClusters Function', objLogInfo);
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    // if (params && params.ShowTabs) {
                        whereCond = {
                            'client_id': strClientID,
                            'tenant_id': strTntId
                        };
                    
                    
                    // } else {
                    //     table_name = 'app_system_to_system'
                    //     columns = ['cluster_code', 's_description']
                    //     whereCond = {
                    //         'app_id': strAppID,
                    //         'cluster_code': params.cluster_code,
                    //         's_id': sid
                    //     };
                    // }

                } else {
                    whereCond = {
                        'client_id': strClientID
                    };
                }
                LoadClusters();

                //Prepare Function
                function LoadClusters() {
                    var objClusters = {};
                    var arrClusters = [];
                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying clusters table', objLogInfo);
                    reqFXDBInstance.GetTableFromFXDB(mClient, table_name, columns, whereCond, objLogInfo, function (pError, pResult) {
                        try {
                            if (pError) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50901', 'Error in Querying clusters table', pError, '', '');

                            } else {
                                reqInstanceHelper.PrintInfo(strServiceName, 'Got result clusters from table', objLogInfo);
                                var rows = pResult.rows
                                if (ISSearch != undefined) {
                                    rows = [];
                                    var searchRows = pResult.rows
                                    if (table_name != 'app_system_to_system') {
                                        for (var i = 0; i < searchRows.length; i++) {
                                            if (searchRows[i].cluster_name.toUpperCase().indexOf(Desc.toUpperCase()) != -1) {
                                                rows.push(searchRows[i])
                                            }
                                        }
                                    } else {
                                        for (var i = 0; i < searchRows.length; i++) {
                                            if (searchRows[i].s_description.toUpperCase().indexOf(Desc.toUpperCase()) != -1) {
                                                rows.push(searchRows[i])
                                            }
                                        }
                                    }
                                    // rows = new reqLINQ(rows)
                                    //     .Where(function (item) {
                                    //         return item.cluster_name.toUpperCase().startsWith(Desc.toUpperCase())
                                    //     }).ToArray();
                                }
                                for (var i = 0; i < rows.length; i++) {
                                    var objCluster = {};
                                    objCluster.CLUSTER_CODE = rows[i].cluster_code;
                                    objCluster.CLUSTER_NAME = rows[i].cluster_name || rows[i].s_description;
                                    objCluster.label = rows[i].cluster_name || rows[i].s_description; // for custom filter
                                    arrClusters.push(objCluster);
                                }
                                objClusters.CLUSTERS = arrClusters;
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, objClusters, objLogInfo, '', '', '', '', '');
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50902', 'Error while Querying clusters table', error, '', '');
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