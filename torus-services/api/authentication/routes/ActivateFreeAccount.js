/*
Modified by: Udhaya
Purpose : Implemeted JWT & tenant_setup 
Modified Date:11-09-2016
*/



var reqExpress = require('express');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqProducer = require('../../../../torus-references/common/Producer');
var router = reqExpress.Router();
var objKH = require('../../../../torus-references/common/gateway/ApiGatewayHelper');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
//var reqMoment = require('moment');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
// var mCltClient = reqCasInstance.SessionValues['clt_cas'];

// var mPltClient = reqCasInstance.SessionValues['plt_cas'];


const SLTMAILTEMPLT = 'select value from platform_setup where code in ?';
const SLTCLINT = 'select client_name,email_id,is_activated,client_password,mobile_no,organisation_name from clients where client_id=?';
const UPDATECLNT = 'update clients set is_activated =? where client_id =? and email_id=?';
const UPDATEFXTOTAL = 'update fx_total_items set counter_value = counter_value+1 where code=\'USERS\'';
const SELECTCOUNT = "select counter_value from fx_total_items where code=?";
const SELECTCODE = "select code_value from code_descriptions where cd_code=?";
const INSERTUSER = "insert into users(login_name,email_id,u_id,first_name,login_password,mobile_no,client_id,created_date,allocated_designer,double_authentication_model) values (?,?,?,?,?,?,?,?,?,?)";
const MAILTEMPLATE = "select value from platform_setup where code in ?";
// need to verify  users_platform_details table required or not 
const PLTINS = 'insert into users_platform_details(client_id,login_name)values(?,?)';
const SELUSER = 'select u_id  from users where client_id=? allow filtering';
const INSPWDLOG = 'insert into user_password_log(u_id,new_password,created_date)values(?,?,?)';
const SELSETUP = 'select category,setup_json from client_setup_source';
const SELTENTSETUPSOURCE = 'select category,setup_json from tenant_setup_source';
const INSCLTSETUP = 'insert into client_setup (client_id,category,description,setup_json)values (?,?,?,?)';
const INSTENANTSETUP = 'insert into tenant_setup (client_id,tenant_id,category,description,setup_json)values (?,?,?,?,?)';
const KONGDETIL = "select * from fx_config_details where category='KONGAPI'";
//const CLINTSETUPSOURCE = 'insert into client_setup_source  (css_id,category,setup_json) values (?,?,?)';

router.get('/ActivateFreeAccount', function (pReq, pResp, pNext) {
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.query, pReq);
    objLogInfo.PROCESS = 'ActivateFreeAccount-Authentication';
    objLogInfo.ACTION = 'ActivateFreeAccount';
    reqLogWriter.Eventinsert(objLogInfo);
    //reqCassandraInstance.GetCassandraConn(pReq.headers, 'plt_cas', function Callback_GetCassandraConn(pltsession) {
    reqDBInstance.GetFXDBConnection(pReq.headers, 'plt_cas', objLogInfo, function (pltsession) {
        var mPltClient = pltsession;
        var pClientid = '';
        try {
            pResp.setHeader('Content-Type', 'text/html');
            // Initialize local variables
            pClientid = pReq.query.key;
            var emailid = '';
            var login_name = '';
            var first_name = '';
            var login_password = '';
            var mobile_no = '';
            var UID = '';
            var Commtemplate = '';
            //ActivateFreeAccount();
            //reqCassandraInstance.GetCassandraConn(pReq.headers, 'clt_cas', function Callback_GetCassandraConn(cltsession) {
            reqDBInstance.GetFXDBConnection(pReq.headers, 'clt_cas', objLogInfo, function (cltsession) {
                var mCltClient = cltsession;
                reqLogInfo.AssignLogInfoDetail(pReq, function (objLogInfo, objSessionInfo) {
                    try {
                        objLogInfo.PROCESS = 'ActivateFreeAccount-Authentication';
                        objLogInfo.ACTION_DESC = 'ActivateFreeAccount';
                        reqLogWriter.Eventinsert(objLogInfo);
                        var pHeaders = pReq.headers;
                        pResp.setHeader('Content-Type', 'text/html');
                        // Initialize local variables
                        var pClientid = pReq.query.key;
                        var emailid = '';
                        var login_name = '';
                        var first_name = '';
                        var login_password = '';
                        var mobile_no = '';
                        var UID = '';
                        var Commtemplate = '';
                        var KONGurl = '';
                        ActivateFreeAccount();

                        function ActivateFreeAccount() {
                            try {
                                //mPltClient = pltsession;
                                //mPltClient.execute(SLTCLINT, [pClientid], {prepare: true}, function callbackSLTCLINT(err, pResult) {
                                reqDBInstance.GetTableFromFXDB(mPltClient, 'CLIENTS', ['client_name', 'email_id', 'is_activated', 'client_password', 'mobile_no', 'organisation_name'], {
                                    'client_id': pClientid
                                }, objLogInfo, function (err, pResult) {
                                    try {
                                        if (err) {
                                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10234-6");
                                        } else {
                                            var param = {};
                                            param.email_id = pResult.rows[0].email_id;
                                            param.mobile_no = pResult.rows[0].mobile_no;
                                            param.client_url = "";
                                            param.needurlreplace = 'N';
                                            param.user_name = pResult.rows[0].client_name;
                                            param.OTP = '';
                                            //mPltClient.execute(SLTMAILTEMPLT, [["ACTIVATED_MAILMSG_TEMPLATE", "ALREADY_ACTIVATED_MAILMSG_TEMPLATE", "SIGNIN_FREE_USR_TEMP"]], {prepare: true}, function callbackSLTMAILTEMPLT(err, pRes) {
                                            reqDBInstance.GetTableFromFXDB(mPltClient, 'PLATFORM_SETUP', ['value'], {
                                                'code': ['ACTIVATED_MAILMSG_TEMPLATE', 'ALREADY_ACTIVATED_MAILMSG_TEMPLATE', 'SIGNIN_FREE_USR_TEMP']
                                            }, objLogInfo, function (err, pRes) {
                                                try {
                                                    if (err) {
                                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10234-7");
                                                    } else {
                                                        //mPltClient.execute(KONGDETIL, [], {prepare: true}, function callbackKONGDETIL(err, kongres) {
                                                        reqDBInstance.GetTableFromFXDB(mPltClient, 'FX_CONFIG_DETAILS', [], {
                                                            'category': 'KONGAPI'
                                                        }, objLogInfo, function (err, kongres) {
                                                            if (err)
                                                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10234-8");
                                                            else {
                                                                var GatewayConfig = JSON.parse(kongres.rows[0].value);
                                                                KONGurl = GatewayConfig;
                                                                if (GatewayConfig != '') {
                                                                    objKH.CreateKongUser(pClientid, param.email_id, GatewayConfig, function (jwtrescallback) {
                                                                        if (jwtrescallback.status == 'SUCCESS') {
                                                                            rwvalActivated = '';
                                                                            rwvalAlreadyActivated = '';
                                                                            if (pResult.rows[0].is_activated == null || pResult.rows[0].is_activated == "N") {
                                                                                rwvalActivated = pRes.rows[0].value;
                                                                                var pTemplate = pRes.rows[2].value;
                                                                                param.SMS_TEMPLATE = JSON.parse(pTemplate).SMS_TEMPLATE;
                                                                                param.MAIL_TEMPLATE = JSON.parse(pTemplate).MAIL_TEMPLATE;
                                                                                reqProducer.ProduceMessage('APCP_OTP', param, pReq.headers, function (response) {
                                                                                    if (err) {
                                                                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10234-9");
                                                                                    } else {
                                                                                        if (response == "SUCCESS") {
                                                                                            reqLogWriter.TraceInfo(objLogInfo, 'Account Login Link mail sent successfully...');
                                                                                            //mPltClient.execute(UPDATECLNT, ['Y', pClientid, param.email_id], {prepare: true}, function callbackUPDATECLNT(err, pResultt) {
                                                                                            reqDBInstance.UpdateFXDB(mPltClient, 'CLIENTS', {
                                                                                                'is_activated': 'Y'
                                                                                            }, {
                                                                                                'client_id': pClientid,
                                                                                                'email_id': param.email_id
                                                                                            }, objLogInfo, function (err, kongres) {
                                                                                                try {
                                                                                                    if (err)
                                                                                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10234-1");

                                                                                                    else {
                                                                                                        //reqCassandraInstance.GetCassandraConn(pReq.headers, 'clt_cas', function Callback_GetCassandraConn(mCltClient) {
                                                                                                        //reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function (pClient) {
                                                                                                        //mCltClient.execute(UPDATEFXTOTAL, ['USERS'], {prepare: true}, function callbackupdatefx(err, pResultes) {
                                                                                                        reqDBInstance.ExecuteQuery(mCltClient, UPDATEFXTOTAL, objLogInfo, function (err, pResultes) {
                                                                                                            try {
                                                                                                                if (err)
                                                                                                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10234-2");

                                                                                                                else {
                                                                                                                    //mCltClient.execute(SELECTCOUNT, ['USERS'], {prepare: true}, function callbackslect(err, pRest) {
                                                                                                                    reqDBInstance.GetTableFromFXDB(mCltClient, 'FX_TOTAL_ITEMS', ['counter_value'], {
                                                                                                                        'code': 'USERS'
                                                                                                                    }, objLogInfo, function (err, pRest) {
                                                                                                                        try {
                                                                                                                            if (err)
                                                                                                                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10234-3");
                                                                                                                            else {
                                                                                                                                var strNewUID = pRest.rows[0].counter_value.low;
                                                                                                                                //mCltClient.execute(SELECTCODE, ['DESIGNER_CODES'], {prepare: true}, function callbackcodedesc(err, pRe) {
                                                                                                                                reqDBInstance.GetTableFromFXDB(mCltClient, 'CODE_DESCRIPTIONS', ['code_value'], {
                                                                                                                                    'cd_code': 'DESIGNER_CODES'
                                                                                                                                }, objLogInfo, function (err, pRe) {
                                                                                                                                    try {
                                                                                                                                        if (err)
                                                                                                                                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10234-4");

                                                                                                                                        else {
                                                                                                                                            var strCodedesc = '';
                                                                                                                                            strCodedesc = pRe.rows[0].code_value;
                                                                                                                                            CreateNewUser(param, pResult, strNewUID, strCodedesc, rwvalActivated, function (Result) {
                                                                                                                                                pResp.send(Result);
                                                                                                                                            });
                                                                                                                                        }
                                                                                                                                    } catch (error) {
                                                                                                                                        errorHandler("ERR-FX-10234-5", "Error ActivateFreeAccount function " + error);
                                                                                                                                    }
                                                                                                                                });
                                                                                                                            }
                                                                                                                        } catch (error) {
                                                                                                                            errorHandler("ERR-FX-10233", "Error ActivateFreeAccount function " + error);
                                                                                                                        }
                                                                                                                    });
                                                                                                                }
                                                                                                            } catch (error) {
                                                                                                                errorHandler("ERR-FX-10232", "Error ActivateFreeAccount function " + error);
                                                                                                            }
                                                                                                        });
                                                                                                        //});
                                                                                                    }
                                                                                                } catch (error) {
                                                                                                    errorHandler("ERR-FX-10231", "Error ActivateFreeAccount function " + error);
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                    }
                                                                                });
                                                                            } else if (pResult.rows[0].is_activated == 'Y') {
                                                                                rwvalAlreadyActivated = pRes.rows[1].value;
                                                                                reqLogWriter.TraceInfo(objLogInfo, 'Account AlreadyActivated');
                                                                                reqLogWriter.EventUpdate(objLogInfo);
                                                                                pResp.send(rwvalAlreadyActivated);
                                                                            }
                                                                        } else {
                                                                            var failResult = "<div style='background-color:lightcoral;color:white;height: 40px'><h3>Your account not activated.Please Check Kong connection/Contact Administrator</h3><br />";
                                                                            pResp.send(failResult);
                                                                        }
                                                                    });
                                                                }
                                                            }
                                                        });

                                                    }
                                                } catch (error) {
                                                    errorHandler("ERR-FX-10230", "Error ActivateFreeAccount function " + error);
                                                }
                                            });
                                        }
                                    } catch (error) {
                                        errorHandler("ERR-FX-10229", "Error ActivateFreeAccount function " + error);
                                    }
                                });
                            } catch (error) {
                                errorHandler("ERR-FX-10228", "Error ActivateFreeAccount function " + error);
                            }
                        }

                        function CreateNewUser(param, pResult, strNewUID, strCodedesc, rwvalActivated, pcallback) {
                            try {
                                //mCltClient.execute(INSERTUSER, [, , , , , , , , , 'BOTH'], { prepare: true }, function callbackinsertuser(err, pRelt) {
                                var arr = [];
                                var row = new Object();
                                row.login_name = param.email_id.toUpperCase();
                                row.email_id = param.email_id.toUpperCase();
                                row.u_id = strNewUID.toString();
                                row.first_name = param.user_name;
                                row.login_password = pResult.rows[0].client_password;
                                row.mobile_no = param.mobile_no;
                                row.client_id = pClientid;
                                row.created_date = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                                row.allocated_designer = strCodedesc;
                                row.double_authentication_model = 'BOTH';
                                arr.push(row);
                                reqDBInstance.InsertFXDB(mCltClient, 'USERS', arr, objLogInfo, function (err, pRelt) {
                                    try {
                                        if (err)
                                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");

                                        else {
                                            //mCltClient.execute(PLTINS, [pClientid, param.email_id.toUpperCase()], {prepare: true}, function callbackpltins(err, result) {
                                            reqDBInstance.InsertFXDB(mCltClient, 'USERS_PLATFORM_DETAILS', [{
                                                'client_id': pClientid,
                                                'login_name': param.email_id.toUpperCase()
                                            }], objLogInfo, function (err, result) {
                                                try {
                                                    if (err) {
                                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");
                                                    } else {
                                                        //mCltClient.execute(SELUSER, [pClientid], {prepare: true}, function callbackseluser(err, res) {
                                                        reqDBInstance.GetTableFromFXDB(mCltClient, 'USERS', ['u_id'], {
                                                            'client_id': pClientid
                                                        }, objLogInfo, function (err, res) {
                                                            try {
                                                                if (err) {
                                                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");
                                                                } else {
                                                                    //mCltClient.execute(INSPWDLOG, [res.rows[0].u_id, pResult.rows[0].client_password, Date.now()], { prepare: true }, function callbackinspwdlog(err, pres) {
                                                                    reqDBInstance.InsertFXDB(mCltClient, 'USER_PASSWORD_LOG', [{
                                                                        'u_id': res.rows[0].u_id,
                                                                        'new_password': pResult.rows[0].client_password,
                                                                        'created_date': reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                                                    }], objLogInfo, function (err, pres) {
                                                                        try {
                                                                            if (err) {
                                                                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");

                                                                            } else {
                                                                                //mCltClient.execute(SELSETUP, [], function callbackselsetup(err, reslt) {
                                                                                reqDBInstance.GetTableFromFXDB(mCltClient, 'CLIENT_SETUP_SOURCE', ['category', 'setup_json'], {}, objLogInfo, function (err, reslt) {
                                                                                    if (err) {
                                                                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");
                                                                                    } else {
                                                                                        var count = 0;
                                                                                        for (var i = 0; i < reslt.rows.length; i++) {
                                                                                            count = count + 1;
                                                                                            console.log('count is ' + count);
                                                                                            var strvalue = reslt.rows[i].setup_json;
                                                                                            strvalue = strvalue.replace("'", "''");
                                                                                            //mCltClient.execute(INSCLTSETUP, [pClientid, reslt.rows[i].category, reslt.rows[i].category, strvalue], {prepare: true}, function callbackinscltsetup(err, resut) {
                                                                                            reqDBInstance.InsertFXDB(mCltClient, 'CLIENT_SETUP', [{
                                                                                                client_id: pClientid,
                                                                                                category: reslt.rows[i].category,
                                                                                                description: reslt.rows[i].category,
                                                                                                setup_json: strvalue
                                                                                            }], objLogInfo, function (err, resut) {
                                                                                                //try {
                                                                                                if (err)
                                                                                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");
                                                                                                else {
                                                                                                    console.log("client_setup insert finished" + count);
                                                                                                }
                                                                                            });
                                                                                            if (count == reslt.rows.length) {
                                                                                                break;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                    //mCltClient.execute(SELTENTSETUPSOURCE, [], {prepare: true}, function callbackSELTENTSETUPSOURCE(err, tenantResult) {
                                                                                    reqDBInstance.GetTableFromFXDB(mCltClient, 'TENANT_SETUP_SOURCE', ['category', 'setup_json'], {}, objLogInfo, function (err, tenantResult) {
                                                                                        if (err)
                                                                                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");
                                                                                        else {

                                                                                            for (j = 0; j < tenantResult.rows.length; j++) {
                                                                                                var tenantcount = 0;
                                                                                                tenantcount++;
                                                                                                //mCltClient.execute(INSTENANTSETUP, [pClientid, '0', tenantResult.rows[j].category, '', tenantResult.rows[j].setup_json], {prepare: true},function callbackINSTENANTSETUP(err, insertlog) {
                                                                                                reqDBInstance.InsertFXDB(mCltClient, 'TENANT_SETUP', [{
                                                                                                    client_id: pClientid,
                                                                                                    tenant_id: '0',
                                                                                                    category: tenantResult.rows[j].category,
                                                                                                    description: '',
                                                                                                    setup_json: tenantResult.rows[j].setup_json
                                                                                                }], objLogInfo, function (err, insertlog) {
                                                                                                    if (err)
                                                                                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");
                                                                                                    else {
                                                                                                        console.log("tenant_setup insert finished" + tenantcount);
                                                                                                    }
                                                                                                });
                                                                                                if (tenantcount == tenantResult.rows.length) {
                                                                                                    break;
                                                                                                } else {
                                                                                                    continue;
                                                                                                }
                                                                                            }

                                                                                            //require js file api helper file--- jwt token generate
                                                                                            objKH.GetConsumerJwtCredential(param.email_id.toUpperCase(), pClientid, KONGurl, function (result) {
                                                                                                if (result) {
                                                                                                    var CredentialJson = result;
                                                                                                    if (CredentialJson.Status == 'FAILURE') {
                                                                                                        var MESSAGE = CredentialJson.Message;
                                                                                                        response = 'FAILURE';
                                                                                                        reqLogWriter.TraceError(objLogInfo, MESSAGE, "ERR-FX-50002");
                                                                                                    }
                                                                                                    var jwtls = {};
                                                                                                    var enablejwt = {
                                                                                                        "ENABLE_JWT": "N"
                                                                                                    };
                                                                                                    jwtls.Token = CredentialJson.Token;
                                                                                                    JWTCasInsert(jwtls, enablejwt, pClientid, function (pres) {
                                                                                                        if (pres) {
                                                                                                            //if (count == reslt.rows.length) {
                                                                                                            reqLogWriter.TraceInfo(objLogInfo, 'Account Acctivated successfully...');
                                                                                                            reqLogWriter.EventUpdate(objLogInfo);
                                                                                                            pcallback(rwvalActivated);


                                                                                                        }
                                                                                                    });
                                                                                                }
                                                                                            });

                                                                                        }
                                                                                    });
                                                                                    // }
                                                                                    // }
                                                                                    //  catch (error) {
                                                                                    //     errorHandler("ERR-FX-10223", "Error ActivateFreeAccount function " + error)
                                                                                    // }

                                                                                });
                                                                            }
                                                                        } catch (error) {
                                                                            errorHandler("ERR-FX-10225", "Error ActivateFreeAccount function " + error);
                                                                        }
                                                                    });
                                                                }
                                                            } catch (error) {
                                                                errorHandler("ERR-FX-10225", "Error ActivateFreeAccount function " + error);
                                                            }
                                                        });
                                                    }
                                                } catch (error) {
                                                    errorHandler("ERR-FX-10224", "Error ActivateFreeAccount function " + error);
                                                }
                                            });
                                        }
                                    } catch (error) {
                                        errorHandler("ERR-FX-10223", "Error Activate Free Account function " + error);
                                    }

                                    function JWTCasInsert(jwtls, enablejwt, pclientid, JWTCasInsertcallback) {

                                        //mCltClient.execute(INSCLTSETUP, [pclientid, 'CURRENT_JWT', 'Kong JWT', JSON.stringify(jwtls)], {prepare: true}, function (err, pReuslt) {
                                        reqDBInstance.InsertFXDB(mCltClient, 'CLIENT_SETUP', [{
                                            client_id: pClientid,
                                            category: 'CURRENT_JWT',
                                            description: 'Kong JWT',
                                            setup_json: JSON.stringify(jwtls)
                                        }], objLogInfo, function (err, pReuslt) {
                                            if (err) {
                                                reqLogWriter.TraceInfo(objLogInfo, 'INSCLTSETUP error', err);
                                            } else {
                                                //mCltClient.execute(INSCLTSETUP, [pclientid, 'ENABLE_JWT', 'Kong JWT Enable', JSON.stringify(enablejwt)], {prepare: true}, function (err, pResult) {
                                                reqDBInstance.InsertFXDB(mCltClient, 'CLIENT_SETUP', [{
                                                    client_id: pClientid,
                                                    category: 'ENABLE_JWT',
                                                    description: 'Kong JWT Enable',
                                                    setup_json: JSON.stringify(enablejwt)
                                                }], objLogInfo, function (err, pReuslt) {
                                                    if (err)
                                                        reqLogWriter.TraceInfo(objLogInfo, 'INSCLTSETUP error', err);
                                                    else {
                                                        //mCltClient.execute(INSTENANTSETUP, [pclientid, '0', "CURRENT_JWT", "Kong JWT", JSON.stringify(jwtls)], {prepare: true}, function (err, pResult) {
                                                        reqDBInstance.InsertFXDB(mCltClient, 'TENANT_SETUP', [{
                                                            client_id: pClientid,
                                                            tenant_id: '0',
                                                            category: 'CURRENT_JWT',
                                                            description: 'Kong JWT',
                                                            setup_json: JSON.stringify(jwtls)
                                                        }], objLogInfo, function (err, pReuslt) {
                                                            if (err) {
                                                                reqLogWriter.TraceInfo(objLogInfo, 'INSCLTSETUP error', err);
                                                            } else {
                                                                //mCltClient.execute(INSTENANTSETUP, [pclientid, '0', "ENABLE_JWT", "Kong JWT Enable", JSON.stringify(enablejwt)], {prepare: true}, function (err, pResult) {
                                                                reqDBInstance.InsertFXDB(mCltClient, 'TENANT_SETUP', [{
                                                                    client_id: pClientid,
                                                                    tenant_id: '0',
                                                                    category: 'ENABLE_JWT',
                                                                    description: 'Kong JWT Enable',
                                                                    setup_json: JSON.stringify(enablejwt)
                                                                }], objLogInfo, function (err, pReuslt) {
                                                                    if (err) {
                                                                        reqLogWriter.TraceInfo(objLogInfo, 'INSCLTSETUP error', err);
                                                                    } else {
                                                                        JWTCasInsertcallback('SUCCESS');
                                                                    }
                                                                });
                                                            }
                                                        });

                                                    }
                                                });
                                            }
                                        });
                                    }

                                });
                            } catch (error) {
                                errorHandler("ERR-FX-10236", "Error ActivateFreeAccount function " + error);
                            }
                        }
                    } catch (error) {
                        errorHandler("ERR-FX-10236", "Error ActivateFreeAccount function " + error);
                    }
                });
            });
        } catch (error) {
            errorHandler("ERR-FX-10236", "Error ActivateFreeAccount function " + error);
        }

        function errorHandler(errcode, message) {
            console.log(message, errcode);
            reqLogWriter.TraceError(objLogInfo, message, errcode);
        }
    });
});
module.exports = router;