/****
  @Descriptions                 : Listing Template Information  
  @Last_Error_Code              : ERR-ListTemplate-0002
 ****/


var reqExpress = require('express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');

var serviceName = 'ListTemplate';

router.post('/ListTemplate', function (appRequest, appResponse) {
    try {
        var pHeader = appRequest.headers;
        var objLogInfo = {};
        var clientParams = appRequest.body.PARAMS;
        var needTenant = clientParams.is_Tenant;
        var needAppId = clientParams.isAppId;
        var condObj = {};
        // condObj.APP_ID = clientParams.APP_ID; // No need to apply any filters, so that we can able to reuse the comm template for any other applications
        if (clientParams.EVENT_CODE) {
            condObj.EVENT_CODE = clientParams.EVENT_CODE;
        }
        if (clientParams.WFTPA_ID) {
            condObj.WFTPA_ID = clientParams.WFTPA_ID;
        }
        if (clientParams.DT_CODE) {
            condObj.DT_CODE = clientParams.DT_CODE;
        }
        if (clientParams.DTT_CODE) {
            condObj.DTT_CODE = clientParams.DTT_CODE;
        }
        if (clientParams.COMMMG_CODE) {
            condObj.COMMMG_CODE = clientParams.COMMMG_CODE;
        }
        if (clientParams.CREATION_MODE) {
            condObj.CREATION_MODE = clientParams.CREATION_MODE;
        }

        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {

            objLogInfo = pLogInfo;
            if (needAppId) {
                condObj['APP_ID'] = objLogInfo.APP_ID;
            }
            if (needTenant) {
                condObj['TENANT_ID'] = objLogInfo.TENANT_ID;
            }



            if (clientParams.ISSEARCH === 'Y') {
                var strQry = '';
                var qryparams = [];
                if (clientParams.COMM_TYPE == 'Kafka') {
                    clientParams.COMM_TYPE = 'kafka'
                }
                if (clientParams.COMM_DESC == '' && clientParams.COMM_TYPE == '') {
                    strQry = `select * from COMM_INFO where creation_mode = ?`;
                    qryparams.push(clientParams.CREATION_MODE)

                } else if (clientParams.COMM_DESC != '' && clientParams.COMM_TYPE == '') {
                    strQry = `select * from COMM_INFO where creation_mode = ? and category_info Like ?`;
                    qryparams.push(clientParams.CREATION_MODE, `%${clientParams.COMM_DESC}%`)

                } else if (clientParams.COMM_DESC != '' && clientParams.COMM_TYPE != '') {
                    strQry = `select * from COMM_INFO where creation_mode = ? and category_info Like ? and comm_type=?`;
                    qryparams.push(clientParams.CREATION_MODE, `${clientParams.COMM_DESC}`, `${clientParams.COMM_TYPE}`)

                } else if (clientParams.COMM_DESC == '' && clientParams.COMM_TYPE != '') {
                    strQry = `select * from COMM_INFO where comm_type=? and creation_mode = ?`
                    qryparams = []
                    qryparams.push(clientParams.COMM_TYPE, clientParams.CREATION_MODE)

                }

                if (needTenant) {
                    strQry = `${strQry} and TENANT_ID = ?`;
                    qryparams.push(objLogInfo.TENANT_ID)
                }
                if (needAppId) {
                    var app_id = objLogInfo.APP_ID;
                    strQry = `${strQry} and APP_ID = ?`
                    qryparams.push(app_id)

                }
                var objQry = {
                    query: strQry,
                    params: qryparams
                }

                reqFXDBInstance.GetFXDBConnection(pHeader, 'dep_cas', objLogInfo, function (depConnection) {
                    reqFXDBInstance.ExecuteSQLQueryWithParams(depConnection, objQry, objLogInfo, function callbackGetTransactionData(res, err) {
                        if (res) {
                            if (res && res.rows.length) {
                                var result = res.rows;
                                reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo, '', '', '', '', '');
                            } else {
                                res = {};
                                res.rows = [];
                                reqInstanceHelper.SendResponse(serviceName, appResponse, res, objLogInfo, '', '', '', '', '');
                            }
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-GetCommProcessData-890001', 'Catch Error in COMM PROCES DATA TABLE ....', err, 'FAILURE', '');
                        }
                    })
                })
            } else {
                reqFXDBInstance.GetFXDBConnection(pHeader, 'dep_cas', objLogInfo, function (depConnection) {
                    reqFXDBInstance.GetTableFromFXDB(depConnection, 'COMM_INFO', [], condObj, objLogInfo, function (error, result) {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-ListTemplate-0002', 'Error While Getting Data into COMM_INFO Table...', error, 'FAILURE', '');
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, result.rows, objLogInfo, '', '', '', '', '');
                        }
                    });
                });
            }

        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-ListTemplate-0001', 'Catch Error in ListTemplate API....', error, 'FAILURE', '');
    }

});

module.exports = router;