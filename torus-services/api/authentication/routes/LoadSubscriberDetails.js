/* Created by Venkatesh
   Create Date 28/June/2016 
Modified By :Udhayaraj Ms For client_id load on screen. on 28-10--2016 

*/

// require depencies
var modPath = '../../../../node_modules/'
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
// Global variable declaration
var mCLIENT_NAME
var mCLIENT_URL
var mLICENSE_MODEL
var mORGANISATION_NAME
var mSHOW_ENVIRONMENT_SETUP
var mSUBS_MODEL
var mUSER_LANGUAGES
var mUSER_LANG_CODE

//cassandra Instance
var mClient = '';
var pHeaders = '';
//Query Preparation
const CLIENTQUERY = 'select email_id, client_name, mobile_no, organisation_name,client_id from clients where client_id=?';
const LICENSEQRY = 'select license_code, license_description, default_component_json from license_model';

//Service Call
router.post('/LoadSubscriberDetails', function (req, resp) {


    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
    objLogInfo.PROCESS = 'LoadSubscriberDetails-Authentication';
    objLogInfo.ACTION = 'LoadSubscriberDetails';
    reqLogWriter.Eventinsert(objLogInfo);

    try {
        pHeaders = req.headers;
        DBInstance.GetFXDBConnection(pHeaders, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
            //reqCasInstance.GetCassandraConn(pHeaders, 'plt_cas', function Callback_GetCassandraConn(pClient) {
            mClient = pClient;
            reqLogWriter.TraceInfo(objLogInfo, 'LoadSubscriberDetails called...');
            var strInputParams = req.body;
            var strCLIENT_ID = '';
            var arrModel = [];
            var objDetail = {};
            var objResult = {};

            LoadSubscriberDetail(strInputParams);

            //Main function
            function LoadSubscriberDetail(pInputParams) {
                _InitializeParams(pInputParams)
                try {
                    DBInstance.GetTableFromFXDB(mClient, 'clients', ['email_id', 'client_name', 'mobile_no', 'organisation_name', 'client_id'], {
                        'client_id': strCLIENT_ID
                    }, objLogInfo, function callbackClientQry(pErr, pResult) {
                        // mClient.execute(CLIENTQUERY, [strCLIENT_ID, ], {
                        //     prepare: true
                        // }, function callbackClientQry(pErr, pResult) {
                        try {
                            if (pErr)
                                reqLogWriter.TraceError(objLogInfo, pErr, "ERR-FX-10166");
                            else {
                                if (pResult.rows.length > 0) {
                                    var rowSubDetail = pResult.rows[0];
                                    var strClientId = '';
                                    var strClientName = '';
                                    var strMobileNo = '';
                                    var strEmailId = '';
                                    var strOrganization = '';

                                    if (rowSubDetail.email_id) {
                                        strEmailId = rowSubDetail.email_id.toString();
                                    }
                                    if (rowSubDetail.client_name) {
                                        strClientName = rowSubDetail.client_name.toString();
                                    }
                                    if (rowSubDetail.mobile_no) {
                                        strMobileNo = rowSubDetail.mobile_no.toString();
                                    }
                                    if (rowSubDetail.organisation_name) {
                                        strOrganization = rowSubDetail.organisation_name.toString();
                                    }
                                    if (rowSubDetail.client_id) {
                                        strClientId = rowSubDetail.client_id;
                                    }
                                    objDetail.CLIENT_ID = strClientId;
                                    objDetail.CLIENT_NAME = strClientName;
                                    objDetail.CLIENT_EMAILID = strEmailId;
                                    objDetail.CLIENT_CONTACT = strMobileNo;
                                    objDetail.ORGANIZATION = strOrganization
                                }
                            }
                            _PrepareLicenseModel();
                        } catch (error) {
                            errorHandler("ERR-FX-10166", "Error LoadSubscriberDetails function" + error)
                        }
                    });
                } catch (err) {
                    console.log(err);
                }
            }


            //Prepare licenceModel function
            function _PrepareLicenseModel() {
                try {
                    DBInstance.GetTableFromFXDB(mClient, 'license_model', ['license_code', 'license_description', 'default_component_json'], {}, objLogInfo, function callbackLicenseQry(pErr, pResult) {
                        // mClient.execute(LICENSEQRY, [], {
                        //     prepare: true
                        // }, function callbackLicenseQry(pErr, pResult) {
                        try {
                            if (pErr)
                                reqLogWriter.TraceError(objLogInfo, pErr, "ERR-FX-10165");
                            else {
                                var licenceModel = pResult.rows;
                                for (var i = 0; i < pResult.rows.length; i++) {
                                    var rowLic = pResult.rows[i];

                                    var strCode = '';
                                    var strDescription = '';
                                    var arrDefCompJson = [];
                                    var objLicenseModel = {};
                                    if (rowLic.license_code) {
                                        strCode = rowLic.license_code.toString();
                                    }
                                    if (rowLic.license_description) {
                                        strDescription = rowLic.license_description.toString()
                                    }
                                    if (rowLic.default_component_json && rowLic.default_component_json) {
                                        var obj = JSON.parse(rowLic.default_component_json);
                                        arrDefCompJson = obj.APAAS_COMPONENTS;

                                    }

                                    objLicenseModel.Code = strCode;
                                    objLicenseModel.Description = strDescription;
                                    objLicenseModel.DefaultComponent = arrDefCompJson;
                                    arrModel.push(objLicenseModel);
                                }
                            }
                            objResult.SUBSCRIBER_DETAIL = objDetail
                            objResult.LICENSEMODEL = arrModel

                            reqLogWriter.TraceInfo(objLogInfo, 'SubscriberDetails loaded...');
                            reqLogWriter.EventUpdate(objLogInfo);
                            resp.send(objResult);
                        } catch (error) {
                            errorHandler("ERR-FX-10165", "Error LoadSubscriberDetails function" + error)
                        }
                    })
                } catch (error) {
                    errorHandler("ERR-FX-10164", "Error LoadSubscriberDetails function" + error)
                }
            }


            //Input Params
            function _InitializeParams(pInputParams) {
                try {
                    if (pInputParams.CLIENT_ID != undefined && pInputParams.CLIENT_ID != '') {
                        strCLIENT_ID = pInputParams.CLIENT_ID;
                    }
                    if (pInputParams.CLIENT_NAME != undefined && pInputParams.CLIENT_NAME != '') {
                        mCLIENT_NAME = pInputParams.CLIENT_NAME;
                    }
                    if (pInputParams.CLIENT_URL != undefined && pInputParams.CLIENT_URL != '') {
                        mCLIENT_URL = pInputParams.CLIENT_URL;
                    }
                    if (pInputParams.LICENSE_MODEL != undefined && pInputParams.LICENSE_MODEL != '') {
                        mLICENSE_MODEL = pInputParams.LICENSE_MODEL;
                    }
                    if (pInputParams.ORGANISATION_NAME != undefined && pInputParams.ORGANISATION_NAME != '') {
                        mORGANISATION_NAME = pInputParams.ORGANISATION_NAME;
                    }
                    if (pInputParams.SHOW_ENVIRONMENT_SETUP != undefined && pInputParams.SHOW_ENVIRONMENT_SETUP != '') {
                        mSHOW_ENVIRONMENT_SETUP = pInputParams.SHOW_ENVIRONMENT_SETUP;
                    }
                    if (pInputParams.SUBS_MODEL != undefined && pInputParams.SUBS_MODEL != '') {
                        mSUBS_MODEL = pInputParams.SUBS_MODEL;
                    }
                    if (pInputParams.USER_LANGUAGES != undefined && pInputParams.USER_LANGUAGES != '') {
                        mUSER_LANGUAGES = pInputParams.USER_LANGUAGES;
                    }
                    if (pInputParams.USER_LANG_CODE != undefined && pInputParams.USER_LANG_CODE != '') {
                        mUSER_LANG_CODE = pInputParams.USER_LANG_CODE;
                    }
                } catch (error) {
                    errorHandler("ERR-FX-10163", "Error LoadSubscriberDetails function" + error)
                }
            }
        })
    } catch (error) {
        errorHandler("ERR-FX-10162", "Error LoadSubscriberDetails function" + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});

module.exports = router;