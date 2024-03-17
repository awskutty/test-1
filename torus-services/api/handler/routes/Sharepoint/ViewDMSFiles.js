var reqExpress = require('express');
var router = reqExpress.Router();
//var reqDBInstance = require('../../../../../torus-references/instance/CassandraInstance');
//var reqCassandraInstance = require('../../../../../torus-references/instance/CassandraInstance');
var reqLogInfo = require('../../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var StringBuilder = require("string-builder");
//var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var serhelper = require('../../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqMoment = require('moment');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');

var objLogInfo = '';
var mTranDB = '';
router.post('/ViewDMSFiles', function(req, res, next) {
    //  reqCassandraInstance.GetCassandraConn(req.headers, 'dep_cas', function Callback_GetCassandraConn(mClient) {
    reqDBInstance.GetFXDBConnection(req.headers, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
        var strOrm = 'knex';
        var DTT_Code = req.body.DTG_CODE;
        var pdynamiccond = req.body.DYNAMIC_COND;
        console.log("dynamiccond" + pdynamiccond);
        var pDTCODE = req.body.DT_CODE;
        var spuid = req.body.SPU_ID;
        console.log("spuid" + spuid);
        var pTTARGET_TABLE = '';
        var pkeycolumn = '';
        //  var APP_ID = '7';
        var APP_ID = req.body.APP_ID;
        var strtargetcolumn = '';
        var strtargetvalue = '';
        var pTTARGET_TABLE = '';
        serhelper.GetKeyColumn(mClient, APP_ID, pDTCODE, DTT_Code, null, function keyresult(pResult) {



            // var strqyery = 'select app_id  from dt_info where APP_ID= ? AND DT_Code=?  limit 1 allow filtering;'
            // mClient.execute(strqyery, [APP_ID, pDTCODE], {
            //     prepare: true
            // }, function(err, pResult) {
            //     if (err)
            //         console.log(err);
            //     else {
            //         if (pResult.rows.length == 0) {
            //             console.log('key_column not found", "ERR-FX-133401');
            //         } else {


            // for (var i = 0; i < pResult.rows.length; i++) {
            //     pkeycolumn = pResult.rows[i].key_column;
            //     pTTARGET_TABLE = pResult.rows[i].target_table;
            // }


            pkeycolumn = pResult.split(",")[1]; //'tsccf_id';
            pTTARGET_TABLE = pResult.split(",")[0]; //'trn_srch_atc';


            if (pdynamiccond != '') {
                var cond = new StringBuilder();
                var dateresult = '';
                var result = JSON.parse(pdynamiccond);
                var JTOKENVALUE = result.LOADDYANMICDATA;
                for (var i = 0; i < JTOKENVALUE.length; i++) {
                    strtargetcolumn = JTOKENVALUE[i].CONTROL_NAME;
                    strtargetcolumn = strtargetcolumn.replace("~", "")


                    // if (strtargetcolumn.indexOf("dte") <= 0) {
                    //     var res = reqMoment(JTOKENVALUE[i].CONTROL_VALUE).format('YYYY- MM-DD HH:mm:ss.SSSS');
                    //     console.log('RESULTING DATE FORMAT' & res);
                    //     JTOKENVALUE[i].CONTROL_VALUE = res;

                    // } else {

                    //     var resVALUE = reqMoment(JTOKENVALUE[i].CONTROL_VALUE).format ('YYYY-MM-DD HH:mm:ss.SSSS');
                    //     console.log('VALUE DATE FORMAT' & resVALUE);

                    //     // strtargetcolumn = strtargetcolumn.replace("dte", "");
                    //     // dateresult = strtargetcolumn.replace('/', '-');
                    //     // dateresult = strtargetcolumn.replace(' ', '-');
                    //     // dateresult = strtargetcolumn.replace(' ', '-');
                    //     // var dateParts = dateresult.split("-");
                    //     // var de = new Date('dateParts[2]', (dateParts[1] - 1), dateParts[0]);
                    //     // console.log(de);
                    //     JTOKENVALUE[i].CONTROL_VALUE = resVALUE
                    // }


                    strtargetvalue = JTOKENVALUE[i].CONTROL_VALUE;
                    console.log("strtargetcolumn" + strtargetcolumn);
                    console.log("strtargetvalue" + strtargetvalue);

                    if (strtargetvalue != '') {
                        if (cond.toString() != '') {
                            cond.append(" AND ")
                        }

                        if (strtargetcolumn.substring(0, 3) == 'dte') {
                            strtargetcolumn = strtargetcolumn + "::date"
                        }
                        strtargetcolumn = strtargetcolumn.replace("txt", "");
                        strtargetcolumn = strtargetcolumn.replace("dte", "");

                        cond.append(strtargetcolumn);
                        console.log("cond.append " + cond.append);
                        cond.append("=")
                        cond.append("'" + strtargetvalue + "'")
                    }

                }
                // FORM DYNAMIC CONDITIONS
                var ccondition = cond.toString();
                console.log("ccondition Resulr" + ccondition);
            }


            // FORM DYNAMIC CONDITIONS'
            //   var cond = new StringBuilder();
            // if (pdynamiccond != '') {
            //     var result = JSON.parse(pdynamiccond);
            //     var JTOKENVALUE = result.LOADDYANMICDATA;
            //     for (var i = 0; i < JTOKENVALUE.length; i++) {
            //         strtargetcolumn = JTOKENVALUE[i].FIELD_NAME;
            //         strtargetvalue = JTOKENVALUE[i].FIELD_VALUE;

            //         if (strtargetvalue != '') {
            //             if (cond.toString() != '') {
            //                 cond.append(" AND ")
            //             }
            //             cond.append(strtargetcolumn.replace("txt", ""))
            //             cond.append("=")
            //             cond.append("'" + strtargetvalue + "'")
            //         }

            //     }
            // }

            // FORM DYNAMIC CONDITIONS
            //   var ccondition = cond.toString();
            // To find trn_id value



            var objLogInfo = reqLogInfo.AssignLogInfoDetail(req.body, req);
            reqTranDBInstance.GetTranDBConn(req.headers, false, function(pSession)

                {
                    mTranDB = pSession;
                    var findtrn_idquery = '';
                    if (spuid != '') {
                        findtrn_idquery = "select " + pkeycolumn + "  from " + pTTARGET_TABLE + "  where spu_id = '" + spuid + "'";
                        console.log("findtrn_idquery" + findtrn_idquery);
                    } else {
                        findtrn_idquery = 'select ' + pkeycolumn + '  from ' + pTTARGET_TABLE + '  where ' + ccondition;
                        console.log("dynamicquery" + findtrn_idquery);
                    }

                    reqTranDBInstance.ExecuteSQLQuery(mTranDB, findtrn_idquery, objLogInfo, function(ptrnResult, pErr) {
                        if (ptrnResult.rows.length == 0) {
                            console.log('key_column not found", "ERR-FX-133402');
                            res.send('FAILURE');
                        } else {
                            var trnidvalues = '';
                            var relativepathvalues = new StringBuilder();
                            for (var j = 0; j < ptrnResult.rows.length; j++) {
                                trnidvalues = trnidvalues + ptrnResult.rows[j][pkeycolumn.toLowerCase()] + ","
                            }


                            if (trnidvalues.charAt(trnidvalues.length - 1) == ',') {
                                trnidvalues = trnidvalues.substring(0, trnidvalues.length - 1);
                            }



                            // Get Relativepath details

                            var strCommQuery = "select relative_path,original_file_name from  trn_attachments where atmt_trn_id in (" + trnidvalues + ")  and atmt_dtt_code ='" + DTT_Code + "';"
                            reqTranDBInstance.ExecuteSQLQuery(mTranDB, strCommQuery, objLogInfo, function(ptrnattachResult, pErr) {
                                try {
                                    if (ptrnattachResult.rows.length == 0) {
                                        console.log('key_column not found", "ERR-FX-133402');
                                    } else {
                                        for (var k = 0; k < ptrnattachResult.rows.length; k++) {
                                            if (spuid != '') {
                                                relativepathvalues.append(ptrnattachResult.rows[k]['relative_path'] + ",")
                                            } else {
                                                relativepathvalues.append(ptrnattachResult.rows[k]['relative_path'] + ":" + ptrnattachResult.rows[k]['original_file_name'] + ",")
                                            }
                                        }
                                        var result = relativepathvalues.toString();
                                        if (result.charAt(result.length - 1) == ',') {
                                            result = result.substring(0, result.length - 1);
                                        }
                                    }

                                    res.send(result);

                                } catch (error) {
                                    errorHandler("ERR-FX-13405", "Error in ViewDMSFiles function" + error)
                                }
                            });

                        }
                    });
                });

            //         }
            //     }
            // });
        });

        function errorHandler(errcode, message) {
            console.log(message, errcode);
            reqLogWriter.TraceError(objLogInfo, message, errcode);
        }
    });
});

module.exports = router;