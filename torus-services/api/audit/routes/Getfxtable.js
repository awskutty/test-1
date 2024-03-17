var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var serviceName = 'Getfxtable'
var reqLinq = require('node-linq').LINQ;
router.post('/Getfxtable', function (appRequest, appResponse) {
    try {
        var mHeaders = appRequest.headers
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                reqDBInstance.GetTableFromFXDB(clt_cas_instance, 'tenant_setup', [], {
                    category: 'FX_TABLES',
                    tenant_id: objLogInfo.TENANT_ID
                }, objLogInfo, function (pError, result) {
                    if (pError) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, pError, objLogInfo, 'ERR-AUDIT-100001', 'Exception Error Occured', '', '', pError);
                    } else {
                        var Result = JSON.parse(result.rows[0].setup_json)
                        var Json_value = Result['FX_TABLES']
                        var Tablearray = []
                        for (let i = 0; i < Json_value.length; i++) {
                            var Tableobj = {}
                            Tableobj.table_desc = Json_value[i]['table_desc']
                            Tableobj.table_name = Json_value[i]['table_name']
                            Tablearray.push(Tableobj)
                        }



                        Tablearray = new reqLinq(Tablearray)
                            .OrderBy(function (u) {
                                return u.table_desc
                            }).ToArray();

                        reqInstanceHelper.SendResponse(serviceName, appResponse, Tablearray, objLogInfo, 'SUCCESS', '', '', '', '');
                    }
                })
            })
        })

    } catch (error) {

    }


});
module.exports = router