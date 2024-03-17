var reqExpress = require('express');
var router = reqExpress.Router();
var async = require("async");
router.get('/Ping', function (pReq, pRes) {
    try {
        var Updateparam = pReq.query;
        if (Updateparam.param && Updateparam.param.toUpperCase() == "UPDATE_ST_CODE") {
            var DBInstance = require('../../../../torus-references/instance/DBInstance');
            // New column ST_CODEcreated in APP_SYSTEM_TO_SYSTEM table, need to update for the old data.
            var pHeaders = pReq.headers;
            var objLogInfo = {}
            var fullappsys = []
            DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                DBInstance.GetTableFromFXDB(pClient, 'APP_SYSTEM_TO_SYSTEM', ['st_id', 'app_id', 'appsts_id', 'cluster_code'], {}, objLogInfo, function (err, res) {
                    if (err) {

                    } else {
                        fullappsys = res.rows
                        queryst()
                    }

                })

                function queryst() {
                    try {
                        async.forEachOfSeries(fullappsys, function (data, indx, callback) {
                            console.log('indx value is ------------------------' + indx)
                            DBInstance.GetTableFromFXDB(pClient, 'SYSTEM_TYPES', ['st_code'], {
                                'st_id': data.st_id
                            }, objLogInfo, function (err, res) {
                                if (err) {
                                    pRes.send(err)
                                } else {
                                    if (res.rows.length) {
                                        updatestcode(data, res.rows, function (res) {
                                            callback()
                                        })
                                    } else {
                                        callback()
                                    }
                                }
                            })
                        }, function (error) {
                            if (error) {
                                pRes.send('Error occured  async  ' + error)
                            } else {
                                pRes.send('SUCCESS')
                            }
                        })
                    } catch (error) {
                        pRes.send('exception occured 2 ' + error)
                    }
                }

                function updatestcode(pdata, updateRow, pcallback) {
                    try {
                        DBInstance.UpdateFXDB(pClient, 'APP_SYSTEM_TO_SYSTEM', {
                            'st_code': updateRow[0].st_code
                        }, {
                            'appsts_id': pdata.appsts_id,
                            'app_id': pdata.app_id,
                            'cluster_code': pdata.cluster_code
                        }, objLogInfo, function (error, res) {
                            if (error) {
                                pRes.send(error)
                            } else {
                                pcallback()
                            }
                        })

                    } catch (error) {
                        pRes.send('exception occured ' + error)
                    }
                }
            })
        } else {
            pRes.send('SUCCESS');
        }
    } catch (error) {
        console.log(error);
    }
});

module.exports = router;