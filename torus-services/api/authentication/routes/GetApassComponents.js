/*  Created BY      :Udhaya
    Created Date    :02-jul-2016
    purpose          :Load the Apass Components AP Login
    */
// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
// var StringBuilder = require('string-builder');
var reqLINQ = require(modPath + "node-linq").LINQ;
// var mClient = reqCasInstance.SessionValues['plt_cas'];
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');

//Prepare Query
const APAASCOMP = "select apc_id, apc_type, apc_category, apc_code, apc_desc, apc_os, apc_param_json, def_qty_reqd, license_duration_json, license_price_json, version_no from apaas_components";

//Host api
router.get('/GetApassComponents', function (req, resp, next) {
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.query, req);
    objLogInfo.PROCESS = 'GetApassComponents-Authentication';
    objLogInfo.ACTION = 'GetApassComponents';
    reqLogWriter.Eventinsert(objLogInfo);

    try {

        //Function call
        GetApassComponents();

        //Prepare function
        function GetApassComponents() {
            try {
                DBInstance.GetFXDBConnection(pReq.headers, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                    reqLogWriter.TraceInfo(objLogInfo, 'GetApassComponents called...');
                    var objApsascom = {};
                    var arrApaascom = [];
                    DBInstance.GetTableFromFXDB(mClient, 'apaas_components', [apc_id, apc_type, apc_category, apc_code, apc_desc, apc_os, apc_param_json, def_qty_reqd, license_duration_json, license_price_json, version_no], {}, objLogInfo, function callbackAPAASCOMP(err, pResult) {
                        // mClient.execute(APAASCOMP, [], {
                        //     prepare: true
                        // }, function callbackAPAASCOMP(err, pResult) {
                        try {

                            if (err)
                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10123");
                            else {
                                //LINQ Query Oreder by the result
                                var OrderResult = new reqLINQ(pResult.rows)
                                    .OrderBy(function (u) {
                                        return u.apc_id
                                    }).ToArray();
                                for (i = 0; i < pResult.rows.length; i++) {

                                    //variable Declare
                                    var strApaasId = '';
                                    var strApaasDecscription = '';
                                    var strApaasCategory = '';
                                    var strApaasType = '';
                                    var strApaasCode = '';
                                    var strApaasPlatform = '';
                                    var objApaasParam = {};
                                    var objDefQty = {};
                                    var objlicDur = {};
                                    var objlicPrice = {};
                                    var straPaasVersionNo = ''
                                    var objApaasin = {};

                                    //Prepare JSON
                                    strApaasId = pResult.rows[i].apc_id.toString();
                                    objApaasin.APC_ID = strApaasId;
                                    strApaasCode = pResult.rows[i].apc_code.toString();
                                    objApaasin.APC_CODE = strApaasCode;
                                    if (pResult.rows[i].apc_category != '' && pResult.rows[i].apc_category != null && pResult.rows[i].apc_category != undefined) {
                                        strApaasCategory = pResult.rows[i].apc_category.toString();
                                        objApaasin.APC_CATEGORY = strApaasCategory;
                                    }
                                    if (pResult.rows[i].apc_type != '' && pResult.rows[i].apc_type != null && pResult.rows[i].apc_type != undefined) {
                                        strApaasType = pResult.rows[i].apc_type.toString();
                                        objApaasin.APC_TYPE = strApaasType;
                                    }
                                    if (pResult.rows[i].apc_desc != '' && pResult.rows[i].apc_desc != null && pResult.rows[i].apc_desc != undefined) {
                                        strApaasDecscription = pResult.rows[i].apc_desc.toString();
                                        objApaasin.APC_DESC = strApaasDecscription;
                                    }
                                    if (pResult.rows[i].version_no != '' && pResult.rows[i].version_no != null && pResult.rows[i].version_no != undefined) {
                                        straPaasVersionNo = pResult.rows[i].version_no.toString();
                                        objApaasin.VERSION_NO = straPaasVersionNo;
                                    }
                                    if (pResult.rows[i].apc_os != '' && pResult.rows[i].apc_os != null && pResult.rows[i].apc_os != undefined) {
                                        strApaasPlatform = pResult.rows[i].apc_os.toString();
                                        objApaasin.APC_OS = strApaasPlatform;
                                    }
                                    if (pResult.rows[i].apc_param_json != '' && pResult.rows[i].apc_param_json != null && pResult.rows[i].apc_param_json != undefined) {
                                        objApaasParam = JSON.stringify(pResult.rows[i].apc_param_json);
                                        objApaasin.APC_PARAM_JSON = objApaasParam;
                                    }
                                    if (pResult.rows[i].def_qty_reqd != '' && pResult.rows[i].def_qty_reqd != null && pResult.rows[i].def_qty_reqd != undefined) {
                                        objDefQty = JSON.stringify(pResult.rows[i].def_qty_reqd);
                                        objApaasin.DEF_QTY_REQD = objDefQty;
                                    }
                                    if (pResult.rows[i].license_duration_json != '' && pResult.rows[i].license_duration_json != null && pResult.rows[i].license_duration_json != undefined) {
                                        objlicDur = JSON.stringify(pResult.rows[i].license_duration_json);
                                        objApaasin.LICENSE_DURATION_JSON = objlicDur
                                    }

                                    if (pResult.rows[i].license_price_json != '' && pResult.rows[i].license_price_json != null && pResult.rows[i].license_price_json != undefined) {
                                        objlicPrice = JSON.stringify(pResult.rows[i].license_price_json);
                                        objApaasin.LICENSE_PRICE_JSON = objlicPrice;
                                    }
                                    arrApaascom.push(objApaasin);
                                }
                                objApsascom.APAAS_COMPONENTS = arrApaascom;
                                reqLogWriter.TraceInfo(objLogInfo, 'Final array ' + JSON.stringify(objApsascom));

                                //Send response to client 
                                reqLogWriter.EventUpdate(objLogInfo);
                                reqLogWriter.TraceInfo(objLogInfo, 'GetApassComponents Loaded successfully...');
                                resp.send(objApsascom);
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-10123", "Error GetApassComponents function" + error)
                        }
                    });
                });
            } catch (error) {
                errorHandler("ERR-FX-10122", "Error GetApassComponents function" + error)
            }
        }
    } catch (error) {
        errorHandler("ERR-FX-10121", "Error GetApassComponents function" + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
})


module.exports = router;
/******** End of Service ********/