/*  Created BY      :Gomathi
    Created Date    :01-Nov-2023
    pupose          :LoadClusters based on the login system selection  
    @Api_Name : /GetSystemCluster,
    @Description: To get system based Clusters
    @Last_Error_code:ERR-MIN-50907
      */

// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLINQ = require(modPath + "node-linq").LINQ;
var unique = require('array-unique');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');

//Global variable Initialization
var strServiceName = "GetSystemCluster";


//host the method to express
router.post('/GetSystemCluster', function (appRequest, appResponse) {
    var objLogInfo;
    var params = appRequest.body.PARAMS;
    if (params != '') {
        var sId = params.SId;
        var appId = params.Appid
        var arrsysclus = [];
    }
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
            objLogInfo.HANDLER_CODE = 'GetSystemCluster';           
            objLogInfo.ACTION_DESC = 'GetSystemCluster';
            var mHeaders = appRequest.headers;
           



            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                reqInstanceHelper.PrintInfo(strServiceName, 'Cassandra Connection Initiated Successfully', objLogInfo);
                var mClient = pCltClient;                
                var strClientID = sessionInfo.CLIENT_ID;
                var  GetFinalclusters = [];
              
               

                //Function call
                reqInstanceHelper.PrintInfo(strServiceName, 'Calling LoadClusters Function', objLogInfo);
                LoadClustersSys();

                //Prepare Function
                function LoadClustersSys() {                    
                    reqInstanceHelper.PrintInfo(strServiceName, 'app_system_to_system', objLogInfo);
                    var selectquery = {
                        query: `select * from app_system_to_system where (s_id =? or parent_s_id=?) and app_id=?`,
                        params: [sId,sId, appId]
                    }
                  

                    reqFXDBInstance.ExecuteSQLQueryWithParams(mClient, selectquery, objLogInfo, function callback(pResult, pError) { 
                   
                        try {
                            if (pError) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50904', 'Error in Querying app_system_to_system table', pError, '', '');

                            } else {
                                reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_system_to_system table', objLogInfo);
                                if (pResult.rows.length > 0) {
                                var clustersysrows = pResult.rows
                                                                    
                                    var arrcluster = [];
                                     GetFinalclusters = new reqLINQ(clustersysrows)
                                        .Select(function (cluster) {
                                         return cluster.cluster_code;
                                     }).ToArray();
                                     GetFinalclusters = unique(GetFinalclusters);  

                                     reqFXDBInstance.GetTableFromFXDB(mClient, 'clusters', ['cluster_code', 'cluster_name'], {
                                        'client_id': strClientID
                                    }, objLogInfo, function (PErr, PResult) {
                                        if(!PErr){
                                        var ClusterRows = PResult.rows
                                        arrsysclus = []
                                        for(var k=0;k<GetFinalclusters.length;k++){                                           
                                           
                                        for(var i=0;i<ClusterRows.length;i++){                                               
                                            if(GetFinalclusters[k] == ClusterRows[i].cluster_code){
                                                var objcluster = {}  
                                                objcluster.CLUSTER_CODE = ClusterRows[i].cluster_code;
                                                objcluster.CLUSTER_NAME = ClusterRows[i].cluster_name;
                                                objcluster.label = ClusterRows[i].cluster_name;    
                                                arrsysclus.push(objcluster); 
                                            }  
                                         }
                                         
                                        }   
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, arrsysclus , objLogInfo, '', '', '', '', '');    
                                    }                                      
                                    })                                                         
                                     
                                    }
                                    else{
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50905', 'No records in app_system_to_system table', error, '', '');
                                    }
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50906', 'Error while Querying app_system_to_system table', error, '', '');
                            
                        }
                    
                    })
                }
            });
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50907', 'Error while calling LoadClusters API function', error, '', '');
       
    }

    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });

})
module.exports = router;
//*******End of Serive*******//