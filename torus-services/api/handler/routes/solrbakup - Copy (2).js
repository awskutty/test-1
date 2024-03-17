// single delete

const { promises } = require('form-data');
var reqSolrHelper = require('../../../../torus-references/instance/SolrInstance');
const { resolve } = require('path');
const { reject } = require('lodash');
const { Promise } = require('q');
var pheader = {
    routingkey: 'TEST'
}

var current_page = 1;
var recordsPerPage = 20

var sourceCore = 'PROD_TRAN'
var DestCore = 'TRAN_TEST'
startProcess()


function startProcess() {
    try {
        // get data
        console.log('current_page ' + current_page)
        reqSolrHelper.SolrSearchWithPaging(pheader, sourceCore, "*:*", recordsPerPage, current_page, function (solrRes) {
            try {
                if (solrRes.response && solrRes.response.docs) {
                    console.log('Current processing document count ' + solrRes.response.docs.length);
                    console.log('Total number of records in solr ' + solrRes.response.numFound);
                    var arrData = solrRes.response.docs;
                    if (arrData.length) {
                        var SourceData = JSON.parse(JSON.stringify(arrData));
                        var insertData = []
                        for (var i = 0; i < arrData.length; i++) {
                            // delete arrData[i]['TC_ID']
                            delete arrData[i]['_version_']
                            insertData.push(arrData[i])
                        }
                        // Insert data into destination core
                        reqSolrHelper.getSolrUserConn(pheader, DestCore, function (solrconn) {
                            try {
                                reqSolrHelper.SolrInsert(solrconn, insertData, {}, async function (error, InsertRes) {
                                    if (error) {

                                    } else {
                                        console.log('selected data inserted into destination solr core')
                                        // update the inserted values as taken true
                                        // var sourceUpdateData = [];
                                        for (var j = 0; j < SourceData.length; j++) {
                                            //delete SourceData[j]["_version_"]
                                            // SourceData[j]["TAKEN"] = 1;
                                            // SourceData[j]["_version_"] = 0;
                                            // sourceUpdateData.push(SourceData[j])
                                            var pCond = {
                                                column: "_version_",
                                                value: SourceData[j]["_version_"]
                                            }
                                            await recordfromsolr(pCond)

                                        }
                                        current_page = current_page + 1
                                        startProcess();

                                        // reqSolrHelper.SolrUpdate(pheader, sourceCore, sourceUpdateData, {}, async function (updateRes) {
                                        //     for (k = 0; k < sourceUpdateData.length; k++) {
                                        //         var pCond = {
                                        //             column: "_version_",
                                        //             value: sourceUpdateData[k]["_version_"]
                                        //         }
                                        //         await recordfromsolr(pCond)
                                        //     }
                                        // })
                                        // delete update records  
                                        function recordfromsolr(pCond) {
                                            return new Promise((resolve, reject) => {
                                                // reqSolrHelper.SolrUpdate(pheader, sourceCore, sourceUpdateData, {}, function (updateRes) {
                                                console.log('Data Update as taken true to source solr core')
                                                reqSolrHelper.SolrDelete(pheader, sourceCore, pCond.column, [pCond.value], {}, function (DelRes) {
                                                    console.log('Data deleted from source solr core');
                                                    // current_page = current_page + 1
                                                    resolve()
                                                    // startProcess();

                                                })
                                                // })
                                            })
                                        }

                                    }
                                })
                            } catch (error) {
                                console.log(error)
                            }
                        })
                    } else {
                        console.log('data not available in sourcce solr core')
                    }
                } else {
                    console.log(solrRes)
                }

            } catch (error) {
                console.log(error);
                startProcess()
            }

        })

    } catch (error) {
        console.log(error)
    }
}