/**
 * Description :  To insert data to solr core
 */

// Require dependencies
var solrInstance = require('../../../instance/SolrInstance');
var reqInstanceHelper = require('../../InstanceHelper');

// this will call write solr for transaction
function insertToSolr(pContent, pCoreName, pHeaders, callback) {
    try {
        if (pContent) {
            solrInstance.GetSolrSearchConn(pHeaders, pCoreName.toUpperCase(), function(pSolrClient) {
                writeToSolr(pSolrClient, pContent, function(result) {
                    try {
                        if (result == 'SUCCESS') {
                            //solrInstance.Commit(pSolrClient, true)
                        } else {
                            //solrInstance.Commit(pSolrClient, false)
                        }
                        return callback(result);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, error, '', null);
                    }
                });
            })
        } else {
            console.log("Content must be specified.");
        }
        // });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, error, '', null);
    }
}

// this is for Insert via SolrClient
function writeToSolr(pSolrClient, pMessage, callback) {
    try {
        //console.log(pMessage);
        solrInstance.SolrInsert(pSolrClient, pMessage, null, function callbackSolrAdd(error, result) {
            if (error) {
                console.log('Solr err:', error);
                return callback('FAILURE');
            } else {
                //console.log('Solr response:', result);
                return callback('SUCCESS')
            }
        });
        // return callback('FAILURE');
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, error, '', null);
    }
}

function getFilteredDocuments(pHeaders, pCoreName, pCond, callback) {
    solrInstance.SolrSearch(pHeaders, pCoreName, pCond, function callbackSolrSearch(pObj) {
        callback(pObj);
    })
}

module.exports = {
    InsertToSolr: insertToSolr,
    GetFilteredDocuments: getFilteredDocuments
}
/********* End of File *************/