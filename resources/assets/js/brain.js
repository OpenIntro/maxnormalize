var duplicate_count=0;
var record_count=0;
var brain = {
    init: function(settings){
        brain.config = {
            $processBtn: $("#btn-process"),
            $formName: $("#parseform"),
            currentDate: new Date(),
            timeStamp: '',
            subByDayData: {values: []},
            masterByDayData: {values: []},
            subByTotalData: {values: []},
            translationErrors: [],
            combineRecords: true,
            filesToProcess: 0,
            devMode: false
        };
        $.extend(brain.config, settings);
        brain.ready();
    },
    ready: function(){
        this.config.$processBtn.click(function(e){
            var isValid = brain.config.$formName.parsley().validate();
            if (isValid) {
                brain.config.uploadedFiles = 0;
            }
            e.preventDefault();
        });

        // init dropzone
        brain.dropzone();

    },
    dropzone: function(){
        Dropzone.autoDiscover = false;
        new Dropzone('#dropzone', { 
            url: "upload.php",
            dictDefaultMessage: '<div class="dz-message">Drop files here to upload</div>',
            paramName: "file", // The name that will be used to transfer the file
            maxFilesize: 2, // MB
            accept: function(file, done) {
                done();
            },
            renameFilename: brain.cleanFilename,
            acceptedFiles: '.csv',
            addRemoveLinks: true,
            autoProcessQueue: false,
            parallelUploads: 30,
            init: function() {
                myDropzone = this;
                brain.config.$processBtn.on('click', function(e) {
                    var isValid = brain.config.$formName.parsley().validate();
                    if (isValid) {
                        if (brain.config.combineRecords) { brain.config.filesToProcess = myDropzone.files.length; } // how many CSV files are uploaded
                        console.log(brain.config.filesToProcess + ' files to process');
                        e.preventDefault();
                        myDropzone.processQueue(); 
                    }
                });

                // this.on("success", function() {
                //    myDropzone.options.autoProcessQueue = true; 
                // });
                // myDropzone.on("sending", function(file, xhr, formData) {
                //     // Will send the filesize along with the file as POST data.
                // });
                myDropzone.on("complete", function(file) {
                    myDropzone.removeFile(file);
                    console.log(file.name+' has been uploaded.');
                    var name = $(file.previewElement).find('[data-dz-name]').text();
                    brain.parseCSV(file);
                });
            },
        });
    },
    parseCSV: function(file) {
        // Parse local CSV file
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            // step: function(results, parser) {
            //   console.log("Row data:", results.data);
            //   console.log("Row errors:", results.errors);
            // },
            complete: function(results) {
                // console.log("Finished:", results.data);
                // console.log(JSON.stringify(results.data));

                // This block identifies the incoming data file type
                if (results.meta['fields'][6] == "format" && results.data[0]['format'] == 'adwords') {
                    console.log('This file is from Youtube Adwords');
                    brain.parseDataYoutubeAdwords(results.data,name);
                } else if (results.meta['fields'][0] == "Advertiser") {
                    console.log('This file is from Pandora');
                    brain.parseDataPandora(results.data);
                } else if (results.meta['fields'][16] == "format" && results.data[0]['format'] == 'youtube_analytics') {
                    console.log('This file is from Youtube Analytics');
                    brain.parseDataYoutubeAnalytics(results.data);
                } else if (results.meta['fields'][0] == "subcampaign_id") {
                    console.log('This file is from Manual Input');
                    brain.parseDataRadio(results.data);
                } else if (results.meta['fields'][9] == "format" && results.data[0]['format'] == 'ga') {
                    console.log('This file is from Google Analytics');
                    brain.parseDataGoogleAnalytics(results.data);
                } else if (results.meta['fields'][12] == "format" && results.data[0]['format'] == 'ttr') {
                    console.log('This file is from Pandora TTR');
                    brain.parseDataPandoraTTR(results.data);
                } else if (results.data[0]['format'] == 'swipeup') {
                    console.log('This file is from Snapchat Swipe Up');
                    brain.parseDataSnapchatSwipeUp(results.data);
                } else if (results.data[0]['format'] == 'geofilter') {
                    console.log('This file is from Snapchat Geofilter');
                    brain.parseDataSnapchatGeofilter(results.data);
                // } else if (results.data[0]['format'] == 'xAd') {
                //     console.log('This file is from xAd/Groundtruth');
                //     brain.parseDataxAd(results.data);
                } else if (results.data[0]['format'] == 'spotify_dataxu') {
                    console.log('This file is from Spotify DataXu');
                    brain.parseDataSpotifyDataXu(results.data);
                } else {
                    console.log('Parsing without headers')
                    brain.reparseCSV(file)
                }
            }

        });
    },
    // Re-parse file, removing headers
    reparseCSV: function(file) {
        // Parse local CSV file
        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            // step: function(results, parser) {
            //   console.log("Row data:", results.data);
            //   console.log("Row errors:", results.errors);
            // },
            complete: function(results) {
                // console.log("Finished:", results.data);
                // console.log(JSON.stringify(results.data));

                // This block identifies the incoming data file type
                if (results.data[7][10] == 'xad') {
                    console.log('This file is from xAd/Groundtruth');
                    brain.parseDataxAd(results.data);
                } else {
                    console.log('I don\'t recognize this file type.');
                }
            }

        });
    },
    // Normalize Data from Pandora Audio Everywhere to Subcampaign by Day
    parseDataPandoraSAVEFORQUESTION: function(data) {
        var publisher_id   = 23;
        var subByDayData = brain.config.subByDayData;

        var impressions = 0;
        var clicks = 0;

        for(var i in data) {
            var row = data[i];

            if (row['Advertiser'] != '') {

                // Publisher ID Switch
                var lineitem = row['Line item'].toLowerCase();
                if (lineitem.indexOf('audio') > -1) {
                    publisher_id = 6;
                } else if (lineitem.indexOf('display') > -1)  {
                    publisher_id = 7;
                }

                // Parse out subcampaign
                var subcampaign = row['subcampaign_id'];

                // Convert and normalize date
                var date = row['Date']

                if (i > 0) {
                    var date_prev = data[i-1]['Date'];

                    if (date == date_prev) {
                        impressions += parseInt(data[i]['Total impressions']);     
                        clicks += parseInt(data[i]['Total clicks']);            
                    }
                    else {

                        // Push Impressions
                        subByDayData.values.push({ 
                            "subcampaign_id" : subcampaign,
                            "date"           : date_prev,
                            "publisher_id"   : publisher_id,
                            "metric_id"      : '3',
                            "metric_value"   : impressions,
                            "is_subcampaign" : "1"
                        });
                        // Push Clicks
                        subByDayData.values.push({ 
                            "subcampaign_id" : subcampaign,
                            "date"           : date_prev,
                            "publisher_id"   : publisher_id,
                            "metric_id"      : '4',
                            "metric_value"   : clicks,
                            "is_subcampaign" : "1"
                        });  
                    

                        impressions = parseInt(data[i]['Total impressions']);
                        clicks = parseInt(data[i]['Total clicks']);   

                    }
                    
                }
                else {
                    impressions = parseInt(data[i]['Total impressions']);
                    clicks = parseInt(data[i]['Total clicks']);                   
                }
                
                // Handles the last date
                if (i == data.length - 1)    {

                    // Push Impressions
                    subByDayData.values.push({ 
                        "subcampaign_id" : subcampaign,
                        "date"           : date,
                        "publisher_id"   : publisher_id,
                        "metric_id"      : '3',
                        "metric_value"   : impressions,
                        "is_subcampaign" : "1"
                    });
                    // Push Clicks
                    subByDayData.values.push({ 
                        "subcampaign_id" : subcampaign,
                        "date"           : date,
                        "publisher_id"   : publisher_id,
                        "metric_id"      : '4',
                        "metric_value"   : clicks,
                        "is_subcampaign" : "1"
                    });
                }

            } // end check of null row
        }

        brain.processCounter();
    },
    // Normalize Data from Pandora Audio Everywhere to Subcampaign by Day
    parseDataPandora: function(data) {
        var publisher_id;
        var subByDayData = brain.config.subByDayData;

        for(var i in data) {    

            var row = data[i];

            if (row['Advertiser'] != '') {

                // Publisher ID Switch
                var lineitem = row['Line item'].toLowerCase();
                if (lineitem.indexOf('audio') > -1) {
                    publisher_id = 6;
                } else if (lineitem.indexOf('display') > -1)  {
                    publisher_id = 7;
                }

                // Parse out subcampaign
                var subcampaign = row['subcampaign_id'];

                // Clean data
                var cost  = row['Cost']
                    cost = cost.replace('$', '');
                    cost = cost.replace(/,/g, "");

                // Convert and normalize date
                var date = row['Date']

                // Push Impressions
                subByDayData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '3',
                    "metric_value"   : row['Total impressions'],
                    "is_subcampaign" : "1"
                });
                // Push Costs
                subByDayData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '1',
                    "metric_value"   : cost,
                    "is_subcampaign" : "1"
                });
                // Push Clicks
                subByDayData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '4',
                    "metric_value"   : row['Total clicks'],
                    "is_subcampaign" : "1"
                });

            } // end check of null row
        }

        brain.processCounter();
    },
    parseDataPandoraTTR: function(data) {
        var publisher_id   = 9;
        var subByTotalData = brain.config.subByTotalData;

        var subcampaign_prev;
        var spend_c = 0;
        var impressions_c = 0;
        var signups_c = 0;

        for(var i in data) {
            var row = data[i];

            if (row['Placement Name'] != '') {

                // Parse out subcampaign
                var subcampaign = row['subcampaign_id'];

                // Clean data
                var spend  = row['CPM Spend']
                    spend = spend.replace('$', '');
                    spend = spend.replace(/,/g, "");
                var impressions  = row['Impressions Delivered'];
                    impressions = impressions.replace(/,/g, "");
                var signups  = row['Reported Sign Ups'];
                    signups = signups.replace(/,/g, "");   

                // Convert and normalize date
                if (i > 0) {
                    var subcampaign_prev = data[i-1]['subcampaign_id'];
                    if (subcampaign == subcampaign_prev) {
                        spend_c += parseInt(spend);
                        impressions_c += parseInt(impressions);
                        signups_c += parseInt(signups);                  
                    }
                    else {
                        // Push CPM Spend
                        subByTotalData.values.push({ 
                            "subcampaign_id" : subcampaign,
                            "start_date"     : row['start_date'],
                            "end_date"       : row['end_date'],
                            "product_id"     : publisher_id,
                            "metric_id"      : '1',
                            "metric_value"   : spend_c,
                            "is_subcampaign" : "1"
                        });
                        // Push Impressions
                        subByTotalData.values.push({ 
                            "subcampaign_id" : subcampaign,
                            "start_date"     : row['start_date'],
                            "end_date"       : row['end_date'],
                            "product_id"     : publisher_id,
                            "metric_id"      : '3',
                            "metric_value"   : impressions_c,
                            "is_subcampaign" : "1"
                        });
                        // Push Signups
                        subByTotalData.values.push({ 
                            "subcampaign_id" : subcampaign,
                            "start_date"     : row['start_date'],
                            "end_date"       : row['end_date'],
                            "product_id"     : publisher_id,
                            "metric_id"      : '63',
                            "metric_value"   : signups_c,
                            "is_subcampaign" : "1"
                        });    

                        spend_c = parseInt(spend);
                        impressions_c = parseInt(impressions);
                        signups_c = parseInt(signups);   

                    }
                    
                }
                else {
                    spend_c = parseInt(spend);
                    impressions_c = parseInt(impressions);
                    signups_c = parseInt(signups);
                }
                
                // Handles the last date
                if (i == data.length - 1)    {

                    // Push CPM Spend
                    subByTotalData.values.push({ 
                        "subcampaign_id" : subcampaign,
                        "start_date"     : row['start_date'],
                        "end_date"       : row['end_date'],
                        "product_id"     : publisher_id,
                        "metric_id"      : '1',
                        "metric_value"   : spend_c,
                        "is_subcampaign" : "1"
                    });
                    // Push Impressions
                    subByTotalData.values.push({ 
                        "subcampaign_id" : subcampaign,
                        "start_date"     : row['start_date'],
                        "end_date"       : row['end_date'],
                        "product_id"     : publisher_id,
                        "metric_id"      : '3',
                        "metric_value"   : impressions_c,
                        "is_subcampaign" : "1"
                    });
                    // Push Signups
                    subByTotalData.values.push({ 
                        "subcampaign_id" : subcampaign,
                        "start_date"     : row['start_date'],
                        "end_date"       : row['end_date'],
                        "product_id"     : publisher_id,
                        "metric_id"      : '63',
                        "metric_value"   : signups_c,
                        "is_subcampaign" : "1"
                    });     
                    
                }

            } // end check of null row
        }

        brain.processCounter();
    },
    // Normalize Data from Youtube Adwords to Subcampaign by Day
    parseDataYoutubeAdwords: function(data) {
       var publisher_id   = 20;
       var subByDayData = brain.config.subByDayData;

        for(var i in data) {    

            var row = data[i];

            if (row.Day != '') {

                // Parse out subcampaign
                var subcampaign = row.Campaign;    
                    subcampaign = subcampaign.split('[').pop().split(']').shift();

                // Convert and normalize date
                var date = moment(row.Day, "D-MMM-YY");
                    date = date.format("M/D/YYYY");

                // Removes $ sign
                var cost  = row.Cost
                    cost = cost.replace('$', '');
                    cost = cost.replace(' ', '');

                // Push Costs
                subByDayData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '1',
                    "metric_value"   : cost,
                    "is_subcampaign" : "1"
                });
                // Push Impressions
                subByDayData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '3',
                    "metric_value"   : row.Impressions,
                    "is_subcampaign" : "1"
                });
                // Push Views
                subByDayData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '12',
                    "metric_value"   : row.Views,
                    "is_subcampaign" : "1"
                });
                // Push Clicks
                subByDayData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '4',
                    "metric_value"   : row.Clicks,
                    "is_subcampaign" : "1"
                });

            } // end check of null row
        }

        brain.processCounter();
    },
    // Normalize Data from Youtube Analytics to Master by Day
    parseDataYoutubeAnalytics: function(data) {
        var publisher_id   = 22;
        var masterByDayData = brain.config.masterByDayData;

        var date_prev;
        var watched_time = 0;
        var views = 0;

        for(var i in data) {
            var row = data[i];

            if (row['date'] != '') {

                // Parse out campaign id
                var master = row['mastercampaign_id'];    

                // Convert and normalize date
                var date = row['date'];
                if (i > 0) {
                    var date_prev = data[i-1]['date'];
                    if (date == date_prev) {
                        watched_time += parseInt(data[i]['watch_time_minutes']);
                        views += parseInt(data[i]['views']);                      
                    }
                    else {

                        var master_prev = data[i-1]['master_campaign_id'];

                        // Push Watch Time
                        masterByDayData.values.push({ 
                            "master_campaign_id" : master,
                            "date"           : date_prev,
                            "product_id"     : publisher_id,
                            "metric_id"      : '16',
                            "metric_value"   : watched_time
                        });
                        // Push Views
                        masterByDayData.values.push({ 
                            "master_campaign_id" : master,
                            "date"           : date_prev,
                            "product_id"     : publisher_id,
                            "metric_id"      : '11',
                            "metric_value"   : views
                        });     
                    

                        watched_time = parseInt(data[i]['watch_time_minutes']);
                        views = parseInt(data[i]['views']);  

                    }
                    
                }
                else {
                    watched_time = parseInt(data[i]['watch_time_minutes']);
                    views = parseInt(data[i]['views']);                           
                }
                
                // Handles the last date
                if (i == data.length - 1)    {

                    // Push Watch Time
                    masterByDayData.values.push({ 
                        "master_campaign_id" : master,
                        "date"           : date,
                        "product_id"     : publisher_id,
                        "metric_id"      : '16',
                        "metric_value"   : watched_time
                    });
                    // Push Views
                    masterByDayData.values.push({ 
                        "master_campaign_id" : master,
                        "date"           : date,
                        "product_id"     : publisher_id,
                        "metric_id"      : '11',
                        "metric_value"   : views
                    });     
                    
                }

            } // end check of null row
        }

        brain.processCounter();
    },
    // Normalize Data from Google Analytics to Master by Day
    parseDataGoogleAnalytics: function(data) {
        var publisher_id   = 5;
        var masterByDayData = brain.config.masterByDayData;

        for(var i in data) {    

            var row = data[i];

            if (row['Day Index'] != '') {

                // Parse out subcampaign
                var master = row['master_campaign_id'];  

                // Convert and normalize date
                var date = row['Day Index'];

                // Convert time on site
                var tos  = row['time on site'];
                var tos_hh = parseInt(tos.slice(0,1))
                    tos_hh = tos_hh * 3600;  // hours to seconds
                var tos_mm = parseInt(tos.slice(2,4))
                    tos_mm = tos_mm * 60; // minutes to seconds
                var tos_ss = parseInt(tos.slice(5)) // seconds
                var tos_total = tos_hh+tos_mm+tos_ss;

                // Push Video Plays
                masterByDayData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '11',
                    "metric_value"   : row['video play']
                });
                // Push Mobile Sessions
                masterByDayData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '59',
                    "metric_value"   : row['mobile sessions']
                });
                // Push Tablet Sessions
                masterByDayData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '60',
                    "metric_value"   : row['tablet sessions']
                });
                // Push Desktop Sessions
                masterByDayData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '61',
                    "metric_value"   : row['desktop sessions']
                });
                // Push Time On Site
                masterByDayData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '38',
                    "metric_value"   : tos_total
                });
                // Push Direct Traffic
                masterByDayData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '2',
                    "metric_value"   : row['direct traffic']
                });
                // Push Additional Events
                masterByDayData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '62',
                    "metric_value"   : row['additional events']
                });

            } // end check of null row
        }

        brain.processCounter();
    },
    // Normalize Data from Radio to Subcampaign Totals
    parseDataRadio: function(data) {
        var publisher_id;
        var subByTotalData = brain.config.subByTotalData;

        for(var i in data) {    

            var row = data[i];

            if (row['subcampaign_id'] != '') {

                // Publisher ID Switch
                if (row['format'] == 'radio') {
                    publisher_id = 10;
                } else if (row['format'] == 'spotify_adstudio') {
                    publisher_id = 13;
                }

                // Parse out subcampaign
                var subcampaign = row['subcampaign_id'];

                // Push Costs
                subByTotalData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : row['start_date'],
                    "end_date"       : row['end_date'],
                    "product_id"     : publisher_id,
                    "metric_id"      : '1',
                    "metric_value"   : row['cost'],
                    "is_subcampaign" : "1"
                });
                // Push Impressions
                subByTotalData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : row['start_date'],
                    "end_date"       : row['end_date'],
                    "product_id"     : publisher_id,
                    "metric_id"      : '3',
                    "metric_value"   : row['impressions'],
                    "is_subcampaign" : "1"
                });
                // Push Clicks
                subByTotalData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : row['start_date'],
                    "end_date"       : row['end_date'],
                    "product_id"     : publisher_id,
                    "metric_id"      : '4',
                    "metric_value"   : row['clicks'],
                    "is_subcampaign" : "1"
                });

            } // end check of null row
        }

        brain.processCounter();
    },
    // Normalize Data from Snapchat Swipe Up to Subcampaign by Day
    parseDataSnapchatSwipeUp: function(data) {
        var publisher_id   = 23;
        var subByDayData = brain.config.subByDayData;

        var spend = 0;
        var impressions = 0;
        var swipeups = 0;

        for(var i in data) {
            var row = data[i];

            if (row['Start time'] != '') {

                // Parse out subcampaign
                var subcampaign = row['Campaign Name'];
                    subcampaign = subcampaign.split('[').pop().split(']').shift();

                // Convert and normalize date
                var date = row['Start time'].substr(0,10);
                    date = moment(date, "YYYY-MM-DD");
                    date = date.format("M/D/YYYY");

                if (i > 0) {
                    var date_prev = data[i-1]['Start time'].substr(0,10);
                        date_prev = moment(date_prev, "YYYY-MM-DD");
                        date_prev = date_prev.format("M/D/YYYY");

                    if (date == date_prev) {
                        spend += parseInt(data[i]['Spend']);
                        impressions += parseInt(data[i]['Impressions']);     
                        swipeups += parseInt(data[i]['Swipe Ups']);            
                    }
                    else {

                        // Push Spend/Cost
                        subByDayData.values.push({ 
                            "subcampaign_id" : subcampaign,
                            "date"           : date_prev,
                            "publisher_id"   : publisher_id,
                            "metric_id"      : '1',
                            "metric_value"   : spend,
                            "is_subcampaign" : "1"
                        });
                        // Push Impressions
                        subByDayData.values.push({ 
                            "subcampaign_id" : subcampaign,
                            "date"           : date_prev,
                            "publisher_id"   : publisher_id,
                            "metric_id"      : '3',
                            "metric_value"   : impressions,
                            "is_subcampaign" : "1"
                        });
                        // Push Impressions
                        subByDayData.values.push({ 
                            "subcampaign_id" : subcampaign,
                            "date"           : date_prev,
                            "publisher_id"   : publisher_id,
                            "metric_id"      : '4',
                            "metric_value"   : swipeups,
                            "is_subcampaign" : "1"
                        });   
                    

                        spend = parseInt(data[i]['Spend']);
                        impressions = parseInt(data[i]['Impressions']);
                        swipeups = parseInt(data[i]['Swipe Ups']);   

                    }
                    
                }
                else {
                    spend = parseInt(data[i]['Spend']);
                    impressions = parseInt(data[i]['Impressions']);
                    swipeups = parseInt(data[i]['Swipe Ups']);                   
                }
                
                // Handles the last date
                if (i == data.length - 1)    {

                    // Push Spend/Cost
                    subByDayData.values.push({ 
                        "subcampaign_id" : subcampaign,
                        "date"           : date,
                        "publisher_id"   : publisher_id,
                        "metric_id"      : '1',
                        "metric_value"   : spend,
                        "is_subcampaign" : "1"
                    });
                    // Push Impressions
                    subByDayData.values.push({ 
                        "subcampaign_id" : subcampaign,
                        "date"           : date,
                        "publisher_id"   : publisher_id,
                        "metric_id"      : '3',
                        "metric_value"   : impressions,
                        "is_subcampaign" : "1"
                    });
                    // Push Impressions
                    subByDayData.values.push({ 
                        "subcampaign_id" : subcampaign,
                        "date"           : date,
                        "publisher_id"   : publisher_id,
                        "metric_id"      : '4',
                        "metric_value"   : swipeups,
                        "is_subcampaign" : "1"
                    });
                }

            } // end check of null row
        }

        brain.processCounter();
    },
    // Normalize Data from Snapchat Geofilter to Subcampaign by Day
    parseDataSnapchatGeofilter: function(data) {
        var publisher_id   = 24;
        var subByDayData = brain.config.subByDayData;

        var spend = 0;
        var impressions = 0;
        var uses = 0;

        for(var i in data) {
            var row = data[i];

            if (row['Date'] != '') {

                // Parse out subcampaign
                var subcampaign = row['subcampaign_id'];

                // Convert and normalize date
                var date = row['Date'];

                if (i > 0) {
                    var date_prev = data[i-1]['Date'];

                    if (date == date_prev) {
                        spend += parseInt(data[i]['Spend']);
                        impressions += (parseInt(data[i]['Swipes']) + parseInt(data[i]['Views']));
                        uses += parseInt(data[i]['Uses']);            
                    }
                    else {

                        // Push Spend/Cost
                        subByDayData.values.push({ 
                            "subcampaign_id" : subcampaign,
                            "date"           : date_prev,
                            "publisher_id"   : publisher_id,
                            "metric_id"      : '1',
                            "metric_value"   : spend,
                            "is_subcampaign" : "1"
                        });
                        // Push Impressions
                        subByDayData.values.push({ 
                            "subcampaign_id" : subcampaign,
                            "date"           : date_prev,
                            "publisher_id"   : publisher_id,
                            "metric_id"      : '3',
                            "metric_value"   : impressions,
                            "is_subcampaign" : "1"
                        });
                        // Push Uses
                        subByDayData.values.push({ 
                            "subcampaign_id" : subcampaign,
                            "date"           : date_prev,
                            "publisher_id"   : publisher_id,
                            "metric_id"      : '21',
                            "metric_value"   : uses,
                            "is_subcampaign" : "1"
                        });   
                    

                        spend = parseInt(data[i]['Spend']);
                        impressions = (parseInt(data[i]['Swipes']) + parseInt(data[i]['Views']));
                        uses = parseInt(data[i]['Uses']);   

                    }
                    
                }
                else {
                    spend = parseInt(data[i]['Spend']);
                    impressions = (parseInt(data[i]['Swipes']) + parseInt(data[i]['Views']));
                    uses = parseInt(data[i]['Uses']);                     
                }
                
                // Handles the last date
                if (i == data.length - 1)    {

                    // Push Spend/Cost
                    subByDayData.values.push({ 
                        "subcampaign_id" : subcampaign,
                        "date"           : date,
                        "publisher_id"   : publisher_id,
                        "metric_id"      : '1',
                        "metric_value"   : spend,
                        "is_subcampaign" : "1"
                    });
                    // Push Impressions
                    subByDayData.values.push({ 
                        "subcampaign_id" : subcampaign,
                        "date"           : date,
                        "publisher_id"   : publisher_id,
                        "metric_id"      : '3',
                        "metric_value"   : impressions,
                        "is_subcampaign" : "1"
                    });
                    // Push Impressions
                    subByDayData.values.push({ 
                        "subcampaign_id" : subcampaign,
                        "date"           : date,
                        "publisher_id"   : publisher_id,
                        "metric_id"      : '21',
                        "metric_value"   : uses,
                        "is_subcampaign" : "1"
                    });
                }

            } // end check of null row
        }

        brain.processCounter();
    },
    // Normalize Data from Spotify DataXu to Subcampaign by Total
    parseDataSpotifyDataXu: function(data) {
        var publisher_id = 14;
        var subByTotalData = brain.config.subByTotalData;

        for(var i in data) {    

            var row = data[i];

            if (row['Flight'] != '') {

                // Parse out subcampaign
                var subcampaign = row['Flight'];
                    subcampaign = subcampaign.split('[').pop().split(']').shift();

                // Clean data

                // Push Impressions
                subByTotalData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : row['Date (flight_start_date)'],
                    "end_date"       : row['Date (flight_end_date)'],
                    "product_id"     : publisher_id,
                    "metric_id"      : '3',
                    "metric_value"   : row['Impressions'],
                    "is_subcampaign" : "1"
                });
                // Push Clicks
                subByTotalData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : row['Date (flight_start_date)'],
                    "end_date"       : row['Date (flight_end_date)'],
                    "product_id"     : publisher_id,
                    "metric_id"      : '4',
                    "metric_value"   : row['Clicks'],
                    "is_subcampaign" : "1"
                });

            } // end check of null row
        }

        brain.processCounter();
    },
    // Normalize Data from xAd/Groundtruth to Subcampaign by Total
    parseDataxAd: function(data) {
        var publisher_id = 19;
        var subByTotalData = brain.config.subByTotalData;

        var campaignDates = data[3][0];
            campaignDates = campaignDates.split(':')[1];
            campaignDates = campaignDates.replace(/ /g, "")
            start_date    = campaignDates.split('-')[0];
            end_date      = campaignDates.split('-')[1];

            start_date = moment(start_date, "M.D.YY");
            start_date = start_date.format("M/D/YYYY");

            end_date = moment(end_date, "M.D.YY");
            end_date = end_date.format("M/D/YYYY");

        for(var i in data) {    

            var row = data[i];

            if (row[10] == 'xad') {

                // Parse out subcampaign
                var subcampaign = row[9];

                var spend = row[4];
                    spend = spend.replace('$', '');

                var impressions = row[1];
                    impressions = impressions.replace(/,/g, "");

                // Clean data

                // Push Spend
                subByTotalData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : start_date,
                    "end_date"       : end_date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '1',
                    "metric_value"   : spend,
                    "is_subcampaign" : "1"
                });
                // Push Impressions
                subByTotalData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : start_date,
                    "end_date"       : end_date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '3',
                    "metric_value"   : impressions,
                    "is_subcampaign" : "1"
                });
                // Push Clicks
                subByTotalData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : start_date,
                    "end_date"       : end_date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '4',
                    "metric_value"   : row[2],
                    "is_subcampaign" : "1"
                });
                // Push Total Visits
                subByTotalData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : start_date,
                    "end_date"       : end_date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '68',
                    "metric_value"   : row[5],
                    "is_subcampaign" : "1"
                });
                // Push Unique Visits
                subByTotalData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : start_date,
                    "end_date"       : end_date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '69',
                    "metric_value"   : row[6],
                    "is_subcampaign" : "1"
                });

            } // end check of null row
        }

        brain.processCounter();
    },
    processCounter: function() {
        // One less file to process
        brain.config.filesToProcess -= 1;
        console.log(brain.config.filesToProcess + ' files left to process');
        
        if (brain.config.filesToProcess == 0) {
            brain.processResults();
        }
    },
    processResults: function() {
        // Process and clear arrays

        if (brain.config.subByDayData.values.length > 0) {
            brain.convertToCSV(brain.config.subByDayData, brain.config.subByDayData.values.length, 'subcampaign_daily');
            brain.config.subByDayData.values.length = 0;
        }
        if (brain.config.subByTotalData.values.length > 0) {
            brain.convertToCSV(brain.config.subByTotalData, brain.config.subByTotalData.values.length, 'subcampaign_total');
            brain.config.subByTotalData.values.length = 0;
        }
        if (brain.config.masterByDayData.values.length > 0) {
            brain.convertToCSV(brain.config.masterByDayData, brain.config.masterByDayData.values.length, 'master_campaign_daily');
            brain.config.masterByDayData.values.length = 0;
        }
    },
    convertToCSV: function(data, records, type) {
        const items = data.values
        const replacer = (key, value) => value === null ? '' : value // specify how you want to handle null values here
        const header = Object.keys(items[0])
        let csv = items.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
        csv.unshift(header.join(','))
        csv = csv.join('\r\n')
        
        brain.showResult(csv, records, type)
    },
    showResult: function(csvData, records, type) {
        var filename = type + '_' + moment().format('MMDDYY[_]hmmss') + '.csv';

        $('.result').show();
        // name = name.replace('csv', 'txt')
        $('#result').append('<p><a href="'+brain.makeTextFile(csvData)+'" download="'+filename+'" class="">Download '+filename+'</a> - <strong>' + records + ' Records</strong>').show();
    },
    makeTextFile: function(text){
        var textFile = null;
        var blob = new Blob([text], {type: 'text/csv'});

        // If we are replacing a previously generated file we need to
        // manually revoke the object URL to avoid memory leaks.
        if (textFile !== null) {
            window.URL.revokeObjectURL(textFile);
        }

        textFile = window.URL.createObjectURL(blob);

        return textFile;
    },
    cleanFilename: function(filename){
        filename = filename.toLowerCase().replace(/[^\w]/gi, '')
        filename = filename.replace('csv', '')
        filename = filename + '-' + moment().format('MMDDYY[_]hmmss') + ".csv";
        return filename;
    },
    groupBy: function(array, property){
        // Array Sort Function
        var hash = {};
        for (var i = 0; i < array.length; i++) {
            if (!hash[array[i][property]]) hash[array[i][property]] = [];
            hash[array[i][property]].push(array[i]);
        }
        return hash;
    }
};