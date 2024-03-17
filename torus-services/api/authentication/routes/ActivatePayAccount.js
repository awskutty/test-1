var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqProducer = require('../../../../torus-references/common/Producer');
var objKH = require('../../../../torus-references/common/gateway/ApiGatewayHelper');
var router = reqExpress.Router();



// var mCltClient = reqCasInstance.SessionValues['clt_cas'];
// var mPltClient = reqCasInstance.SessionValues['plt_cas'];

const SETUP = 'select value from platform_setup where code in ? ';
//const SELCLTSETUPSOURCE = 'select category,setup_json from client_setup_source';
const SELSETUP = 'select category,setup_json from client_setup_source';
const INSERTCLINTSTUP = 'insert into client_setup (client_id, category, description, setup_json) values(?, ?, ?, ?)';
const SELTENTSETUPSOURCE = 'select category,setup_json from tenant_setup_source';
const INSTENANTSETUP = 'insert into tenant_setup (client_id,tenant_id,category,description,setup_json)values (?,?,?,?,?)';
const SLTMAILTEMPLT = 'select value from platform_setup where code=?';
const SLTCLINT = 'select client_name,email_id,is_activated,client_password,mobile_no,organisation_name from clients where client_id=?';
const UPDATECLNT = 'update clients set is_activated =? where client_id =? and email_id=?';
const KONGDETIL = "select * from fx_config_details where category='KONGAPI'";
const INSCLTSETUP = 'insert into client_setup (client_id,category,description,setup_json)values (?,?,?,?)';
//  mCltClient = reqCasInstance.SessionValues['clt_cas'];
// mPltClient = reqCasInstance.SessionValues['plt_cas'];

router.get('/ActivatePayAccount', function(pReq, pResp, pNext) {
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.query, pReq);
    objLogInfo.PROCESS = 'ActivatePayAccount-Authentication';
    objLogInfo.ACTION = 'ActivatePayAccount';
    reqLogWriter.Eventinsert(objLogInfo);
    var pHeaders = pReq.headers;
    //reqCassandraInstance.GetCassandraConn(pReq.headers, 'clt_cas', function Callback_GetCassandraConn(mClient) {
    reqDBInstance.GetFXDBConnection(pReq.headers, 'clt_cas', objLogInfo, function(mClient) {
        var mCltClient = mClient;
        try {
            pResp.setHeader('Content-Type', 'text/html');
            var pclientid = pReq.query.key;
            ActivateFreeAccount();

            function ActivateFreeAccount() {
                try {
                    //reqCassandraInstance.GetCassandraConn(pReq.headers, 'plt_cas', function Callback_GetCassandraConn(mPltClient) {
                    reqDBInstance.GetFXDBConnection(pReq.headers, 'plt_cas', objLogInfo, function(mPltClient) {
                        //mPltClient.execute(SLTCLINT, [pclientid], {prepare: true}, function callbackSLTCLINT(err, pResult) {
                        reqDBInstance.GetTableFromFXDB(mPltClient, 'CLIENTS', ['client_name', 'email_id', 'is_activated', 'client_password', 'mobile_no', 'organisation_name'], {
                            'client_id': pclientid
                        }, objLogInfo, function(err, pResult) {
                            try {
                                if (err)
                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10239");

                                else {
                                    //mPltClient.execute(SLTMAILTEMPLT, ['SIGNIN_PAYABLE_USR_TEMP'], {prepare: true}, function callbackSLTMAILTEMPLT(err, pRes) {
                                    reqDBInstance.GetTableFromFXDB(mPltClient, 'PLATFORM_SETUP', ['value'], {
                                        'code': 'SIGNIN_PAYABLE_USR_TEMP'
                                    }, objLogInfo, function(err, pRes) {
                                        try {
                                            if (err) {
                                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10239");

                                            } else {
                                                rwvalActivated = '';
                                                rwvalAlreadyActivated = '';
                                                for (i = 0; i < pRes.rows.length; i++) {
                                                    //mPltClient.execute(SETUP, [["ACTIVATED_MAILMSG_TEMPLATE", "ALREADY_ACTIVATED_MAILMSG_TEMPLATE"]], {prepare: true}, function callbacksetup(err, res) {
                                                    reqDBInstance.GetTableFromFXDB(mPltClient, 'PLATFORM_SETUP', ['value'], {
                                                        'code': ["ACTIVATED_MAILMSG_TEMPLATE", "ALREADY_ACTIVATED_MAILMSG_TEMPLATE"]
                                                    }, objLogInfo, function(err, res) {
                                                        try {
                                                            if (err) {
                                                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10239");

                                                            } else {
                                                                if (pResult.rows[0].is_activated == null || pResult.rows[0].is_activated == "N") {
                                                                    rwvalActivated = res.rows[0].value;
                                                                    var param = {};
                                                                    param.email_id = pResult.rows[0].email_id;
                                                                    param.mobile_no = pResult.rows[0].mobile_no;
                                                                    param.client_url = "";
                                                                    var pTemplate = pRes.rows[0].value;
                                                                    param.SMS_TEMPLATE = JSON.parse(pTemplate).SMS_TEMPLATE;
                                                                    param.MAIL_TEMPLATE = JSON.parse(pTemplate).MAIL_TEMPLATE;
                                                                    param.needurlreplace = 'N';
                                                                    param.user_name = pResult.rows[0].client_name;
                                                                    param.OTP = '';
                                                                    reqProducer.ProduceMessage('APCP_OTP', param, pReq.headers, function(response) {
                                                                        if (err) {
                                                                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10239");

                                                                        } else {
                                                                            if (response == "SUCCESS") {
                                                                                reqLogWriter.TraceInfo(objLogInfo, 'Account Login Link mail sent successfully...');
                                                                                //mPltClient.execute(UPDATECLNT, ['Y', pclientid, param.email_id], {prepare: true}, function callbackUPDATECLNT(err, pResult) {
                                                                                reqDBInstance.UpdateFXDB(mPltClient, 'CLIENTS', {
                                                                                    'is_activated': 'Y'
                                                                                }, {
                                                                                    'client_id': pclientid,
                                                                                    'email_id': param.email_id
                                                                                }, objLogInfo, function(err, pResult) {
                                                                                    if (err)
                                                                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10239");
                                                                                    else {
                                                                                        //get the value from client setup source
                                                                                        //mCltClient.execute(SELSETUP, [], {prepare: true}, function callbackselsetup(err, reslt) {
                                                                                        reqDBInstance.GetTableFromFXDB(mCltClient, 'CLIENT_SETUP_SOURCE', ['category', 'setup_json'], {}, objLogInfo, function(err, reslt) {
                                                                                            if (err)
                                                                                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");
                                                                                            else {
                                                                                                var count = 0;
                                                                                                for (var i = 0; i < reslt.rows.length; i++) {
                                                                                                    count = count + 1;
                                                                                                    console.log('count is ' + count);
                                                                                                    var strvalue = reslt.rows[i].setup_json;
                                                                                                    strvalue = strvalue.replace("'", "''");
                                                                                                    //insert the clinet setup value into client_setup table
                                                                                                    //mCltClient.execute(INSCLTSETUP, [pclientid, reslt.rows[i].category, reslt.rows[i].category, strvalue], {prepare: true}, function callbackinscltsetup(err, resut) {
                                                                                                    reqDBInstance.InsertFXDB(mCltClient, 'CLIENT_SETUP', [{
                                                                                                        client_id: pclientid,
                                                                                                        category: reslt.rows[i].category,
                                                                                                        description: reslt.rows[i].category,
                                                                                                        setup_json: strvalue
                                                                                                    }], objLogInfo, function(err, resut) {
                                                                                                        //try {
                                                                                                        if (err)
                                                                                                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");
                                                                                                        else {
                                                                                                            console.log("client_setup insert finished " + count);
                                                                                                        }
                                                                                                    })
                                                                                                    if (count == reslt.rows.length) {
                                                                                                        break;
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                            //  })
                                                                                            //mCltClient.execute(SELTENTSETUPSOURCE, [], {prepare: true}, function (err, tenantResult) {
                                                                                            reqDBInstance.GetTableFromFXDB(mCltClient, 'TENANT_SETUP_SOURCE', ['category', 'setup_json'], {}, objLogInfo, function(err, tenantResult) {
                                                                                                if (err)
                                                                                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");
                                                                                                else {
                                                                                                    for (j = 0; j < tenantResult.rows.length; j++) {
                                                                                                        var tenantcount = 0;
                                                                                                        tenantcount++;
                                                                                                        //mCltClient.execute(INSTENANTSETUP, [pclientid, '0', tenantResult.rows[j].category, '', tenantResult.rows[j].setup_json], {prepare: true},function callbackINSTENANTSETUP(err, insertlog) {
                                                                                                        reqDBInstance.InsertFXDB(mCltClient, 'TENANT_SETUP', [{
                                                                                                            client_id: pclientid,
                                                                                                            tenant_id: '0',
                                                                                                            category: tenantResult.rows[j].category,
                                                                                                            description: '',
                                                                                                            setup_json: tenantResult.rows[j].setup_json
                                                                                                        }], {
                                                                                                            prepare: true
                                                                                                        }, function(err, insertlog) {
                                                                                                            if (err)
                                                                                                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10227");
                                                                                                            else {
                                                                                                                console.log("tenant_setup insert finished " + tenantcount);
                                                                                                            }
                                                                                                        })
                                                                                                        if (tenantcount == tenantResult.rows.length) {
                                                                                                            break;
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                                //})
                                                                                                // get config details 
                                                                                                //mPltClient.execute(KONGDETIL, [], {prepare: true}, function callbackKONGDETIL(err, kongres) {
                                                                                                reqDBInstance.GetTableFromFXDB(mPltClient, 'FX_CONFIG_DETAILS', [], {
                                                                                                    'category': 'KONGAPI'
                                                                                                }, objLogInfo, function(err, kongres) {
                                                                                                    if (err)
                                                                                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10234-8");
                                                                                                    else {
                                                                                                        var GatewayConfig = JSON.parse(kongres.rows[0].value)
                                                                                                        KONGurl = GatewayConfig;
                                                                                                        if (GatewayConfig != '') {
                                                                                                            //create kong user
                                                                                                            objKH.CreateKongUser(pclientid, param.email_id, GatewayConfig, function(jwtrescallback) {
                                                                                                                if (jwtrescallback.status == 'SUCCESS') {
                                                                                                                    objKH.GetConsumerJwtCredential(param.email_id.toUpperCase(), pclientid, KONGurl, function(result) {
                                                                                                                        if (result) {
                                                                                                                            var CredentialJson = result;
                                                                                                                            if (CredentialJson.Status == 'FAILURE') {
                                                                                                                                var MESSAGE = CredentialJson.Message
                                                                                                                                response = 'FAILURE';
                                                                                                                                reqLogWriter.TraceError(objLogInfo, MESSAGE, "ERR-FX-50002")
                                                                                                                            }
                                                                                                                            var jwtls = {};
                                                                                                                            var enablejwt = {
                                                                                                                                "ENABLE_JWT": "N"
                                                                                                                            }
                                                                                                                            jwtls.Token = CredentialJson.Token;
                                                                                                                            JWTCasInsert(jwtls, enablejwt, pclientid, function(pres) {
                                                                                                                                if (pres) {
                                                                                                                                    reqLogWriter.TraceInfo(objLogInfo, 'Account Acctivated successfully...');
                                                                                                                                    reqLogWriter.EventUpdate(objLogInfo);
                                                                                                                                    pResp.send(rwvalActivated);
                                                                                                                                }
                                                                                                                            })
                                                                                                                        }
                                                                                                                    })
                                                                                                                } else {
                                                                                                                    reqLogWriter.TraceError(objLogInfo, jwtrescallback.status, "ERR-FX-10234-8");
                                                                                                                    reqLogWriter.EventUpdate(objLogInfo);
                                                                                                                    var failResult = "<div style='background-color:lightcoral;color:white;height: 40px'><h3>Your account not activated.Please Check Kong connection/Contact Administrator</h3><br />";
                                                                                                                    pResp.send(failResult);
                                                                                                                }
                                                                                                            })
                                                                                                        }
                                                                                                    }
                                                                                                })
                                                                                            })
                                                                                        })
                                                                                    }
                                                                                })
                                                                            }
                                                                        }
                                                                    });
                                                                } else if (pResult.rows[0].is_activated == "Y") {
                                                                    rwvalAlreadyActivated = res.rows[1].value;
                                                                    reqLogWriter.TraceInfo(objLogInfo, 'Account Already Activated');
                                                                    reqLogWriter.EventUpdate(objLogInfo);
                                                                    pResp.send(rwvalAlreadyActivated);
                                                                }
                                                            }
                                                        } catch (error) {
                                                            errorHandler("ERR-FX-10239", "Error ActivatePayAccount function " + error)
                                                        }
                                                    })
                                                }
                                            }
                                        } catch (error) {
                                            errorHandler("ERR-FX-10238", "Error ActivatePayAccount function " + error)
                                        }
                                    })
                                }
                            } catch (error) {
                                errorHandler("ERR-FX-10237", "Error ActivatePayAccount function " + error)
                            }
                        });
                    });
                } catch (error) {
                    errorHandler("ERR-FX-10236", "Error ActivatePayAccount function " + error)
                }

            }
        } catch (error) {
            errorHandler("ERR-FX-10235", "Error ActivatePayAccount function " + error)
        }

        function JWTCasInsert(jwtls, enablejwt, pclientid, JWTCasInsertcallback) {


            //mCltClient.execute(INSCLTSETUP, [pclientid, 'CURRENT_JWT', 'Kong JWT', JSON.stringify(jwtls)], {prepare: true}, function (err, pReuslt) {
            reqDBInstance.InsertFXDB(mCltClient, 'CLIENT_SETUP', [{
                    client_id: pclientid,
                    category: 'CURRENT_JWT',
                    description: 'Kong JWT',
                    setup_json: JSON.stringify(jwtls)
                }], objLogInfo, function(err, pReuslt) {
                    if (err) {
                        reqLogWriter.TraceInfo(objLogInfo, 'INSCLTSETUP error', err);
                    } else {
                        //mCltClient.execute(INSCLTSETUP, [pclientid, 'ENABLE_JWT', 'Kong JWT Enable', JSON.stringify(enablejwt)], {prepare: true}, function (err, pResult) {
                        reqDBInstance.InsertFXDB(mCltClient, 'CLIENT_SETUP', [{
                            client_id: pclientid,
                            category: 'ENABLE_JWT',
                            description: 'Kong JWT Enable',
                            setup_json: JSON.stringify(enablejwt)
                        }], objLogInfo, function(err, pReuslt) {
                            if (err)
                                reqLogWriter.TraceInfo(objLogInfo, 'INSCLTSETUP error', err);
                            else {
                                //mCltClient.execute(INSTENANTSETUP, [pclientid, '0', "CURRENT_JWT", "Kong JWT", JSON.stringify(jwtls)], {prepare: true}, function (err, pResult) {
                                reqDBInstance.InsertFXDB(mCltClient, 'TENANT_SETUP', [{
                                    client_id: pclientid,
                                    tenant_id: '0',
                                    category: 'CURRENT_JWT',
                                    description: 'Kong JWT',
                                    setup_json: JSON.stringify(jwtls)
                                }], objLogInfo, function(err, pReuslt) {
                                    if (err) {
                                        reqLogWriter.TraceInfo(objLogInfo, 'INSCLTSETUP error', err);
                                    } else {
                                        //mCltClient.execute(INSTENANTSETUP, [pclientid, '0', "ENABLE_JWT", "Kong JWT Enable", JSON.stringify(enablejwt)], {prepare: true}, function (err, pResult) {
                                        reqDBInstance.InsertFXDB(mCltClient, 'TENANT_SETUP', [{
                                            client_id: pclientid,
                                            tenant_id: '0',
                                            category: 'ENABLE_JWT',
                                            description: 'Kong JWT Enable',
                                            setup_json: JSON.stringify(enablejwt)
                                        }], objLogInfo, function(err, pReuslt) {
                                            if (err) {
                                                reqLogWriter.TraceInfo(objLogInfo, 'INSCLTSETUP error', err);
                                            } else {
                                                JWTCasInsertcallback('SUCCESS')
                                            }
                                        })
                                    }
                                })

                            }
                        })
                    }
                })
                //})
        }

        function errorHandler(errcode, message) {
            console.log(message, errcode);
            reqLogWriter.TraceError(objLogInfo, message, errcode);
        }
    })
});


module.exports = router;