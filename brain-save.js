var duplicate_count=0;
var record_count=0;
var brain = {
    init: function(settings){
        brain.config = {
            $processBtn: $("#btn-process"),
            $formName: $("#parseform"),
            currentDate: new Date(),
            timeStamp: '',
            textData: '',
            subData: '',
            masterData: '',
            recordData: '',
            recordCount: 0,
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
            parallelUploads: 10,
            init: function() {
                myDropzone = this;
                brain.config.$processBtn.on('click', function(e) {
                    var isValid = brain.config.$formName.parsley().validate();
                    if (isValid) {
                        if (brain.config.combineRecords) { brain.config.filesToProcess = myDropzone.files.length; } // how many CSV files are uploaded
                        e.preventDefault();
                        myDropzone.processQueue(); 
                    }
                });

                // this.on("success", function() {
                //    myDropzone.options.autoProcessQueue = true; 
                // });
                // myDropzone.on("sending", function(file, xhr, formData) {
                //     // Will send the filesize along with the file as POST data.
                //     formData.append("vendorEmail", $('#vendorEmail').val());
                //     formData.append("campaignCode", $('#campaignCode').val());
                //     formData.append("vendorID", $('#vendorID').val());
                //     formData.append("sequenceCode", $('#sequenceCode').val());
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

                if (results.meta['fields'][6] == "format" && results.data[0]['format'] == 'youtube') {
                    console.log('This file is from Youtube Adwords');
                    brain.parseDataYoutubeAdwords(results.data,name);
                } else if (results.meta['fields'][0] == "Advertiser") {
                    console.log('This file is from Pandora');
                    brain.parseDataPandora(results.data);
                } else if (results.meta['fields'][16] == "format" && results.data[0]['format'] == 'youtube_analytics') {
                    console.log('This file is from Youtube Analytics');
                    brain.parseDataYoutubeAnalytics(results.data);
                } else if (results.meta['fields'][0] == "subcampaign_id") {
                    console.log('This file is from Radio');
                    brain.parseDataRadio(results.data);
                } else if (results.meta['fields'][9] == "format" && results.data[0]['format'] == 'ga') {
                    console.log('This file is from Google Analytics');
                    brain.parseDataGoogleAnalytics(results.data);
                }
            }

        });
    },
    // Normalize Data from Pandora to Subcampaign by Day
    parseDataPandora: function(data) {
        var publisher_id   = 6;
        var normalizedData = {
            values: []
        };

        for(var i in data) {    

            var row = data[i];

            if (row['Advertiser'] != '') {

                // Parse out subcampaign
                var subcampaign = row['subcampaign_id'];

                // Convert and normalize date
                var date = row['Date']

                // Push Impressions
                normalizedData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '3',
                    "metric_value"   : row['Total impressions'],
                    "is_subcampaign" : "1"
                });
                // Push Clicks
                normalizedData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '4',
                    "metric_value"   : row['Total clicks'],
                    "is_subcampaign" : "1"
                });

            } // end check of null row
        }

        // console.log(normalizedData);

        brain.convertToCSV(normalizedData, 'subcampaign_daily');
    },
    // Normalize Data from Youtube Adwords to Subcampaign by Day
    parseDataYoutubeAdwords: function(data) {
       var publisher_id   = 20;
       var normalizedData = {
            values: []
        };

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
                normalizedData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '1',
                    "metric_value"   : cost,
                    "is_subcampaign" : "1"
                });
                // Push Impressions
                normalizedData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '3',
                    "metric_value"   : row.Impressions,
                    "is_subcampaign" : "1"
                });
                // Push Views
                normalizedData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '11',
                    "metric_value"   : row.Views,
                    "is_subcampaign" : "1"
                });
                // Push Clicks
                normalizedData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "date"           : date,
                    "publisher_id"   : publisher_id,
                    "metric_id"      : '4',
                    "metric_value"   : row.Clicks,
                    "is_subcampaign" : "1"
                });

            } // end check of null row
        }

        // console.log(normalizedData);

        brain.convertToCSV(normalizedData, 'subcampaign_daily');
    },
    // Normalize Data from Youtube Analytics to Master by Day
    parseDataYoutubeAnalytics: function(data) {
        var publisher_id   = 22;
        var normalizedData = {
            values: []
        };

        var date_prev;
        var watched_time = 0;
        var views = 0;

        for(var i in data) {
            var row = data[i];

            if (row['date'] != '') {

                // Parse out subcampaign
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
                        normalizedData.values.push({ 
                            "master_campaign_id" : master,
                            "date"           : date_prev,
                            "product_id"     : publisher_id,
                            "metric_id"      : '16',
                            "metric_value"   : watched_time
                        });
                        // Push Views
                        normalizedData.values.push({ 
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
                    
                if (i == data.length - 1)    {

                    // Push Watch Time
                    normalizedData.values.push({ 
                        "master_campaign_id" : master,
                        "date"           : date_prev,
                        "product_id"     : publisher_id,
                        "metric_id"      : '16',
                        "metric_value"   : watched_time
                    });
                    // Push Views
                    normalizedData.values.push({ 
                        "master_campaign_id" : master,
                        "date"           : date_prev,
                        "product_id"     : publisher_id,
                        "metric_id"      : '11',
                        "metric_value"   : views
                    });     
                    
                }

            } // end check of null row
        }

        // console.log(normalizedData);

        brain.convertToCSV(normalizedData, 'master_campaign_daily');
    },
    // Normalize Data from Google Analytics to Master by Day
    parseDataGoogleAnalytics: function(data) {
        var publisher_id   = 5;
        var normalizedData = {
            values: []
        };

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
                normalizedData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '11',
                    "metric_value"   : row['video play']
                });
                // Push Mobile Sessions
                normalizedData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '59',
                    "metric_value"   : row['mobile sessions']
                });
                // Push Tablet Sessions
                normalizedData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '60',
                    "metric_value"   : row['tablet sessions']
                });
                // Push Desktop Sessions
                normalizedData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '61',
                    "metric_value"   : row['desktop sessions']
                });
                // Push Time On Site
                normalizedData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '38',
                    "metric_value"   : tos_total
                });
                // Push Direct Traffic
                normalizedData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '2',
                    "metric_value"   : row['direct traffic']
                });
                // Push Additional Events
                normalizedData.values.push({ 
                    "master_campaign_id" : master,
                    "date"           : date,
                    "product_id"     : publisher_id,
                    "metric_id"      : '62',
                    "metric_value"   : row['additional events']
                });

            } // end check of null row
        }

        // console.log(normalizedData);

        brain.convertToCSV(normalizedData, 'master_campaign_daily');
    },
    // Normalize Data from Radio to Subcampaign Totals
    parseDataRadio: function(data) {
        var publisher_id   = 10;
        var normalizedData = {
            values: []
        };

        for(var i in data) {    

            var row = data[i];

            if (row['subcampaign_id'] != '') {

                // Parse out subcampaign
                var subcampaign = row['subcampaign_id'];

                // Push Costs
                normalizedData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : row['start_date'],
                    "end_date"       : row['end_date'],
                    "product_id"     : publisher_id,
                    "metric_id"      : '1',
                    "metric_value"   : row['cost'],
                    "is_subcampaign" : "1"
                });
                // Push Impressions
                normalizedData.values.push({ 
                    "subcampaign_id" : subcampaign,
                    "start_date"     : row['start_date'],
                    "end_date"       : row['end_date'],
                    "product_id"     : publisher_id,
                    "metric_id"      : '3',
                    "metric_value"   : row['impressions'],
                    "is_subcampaign" : "1"
                });

            } // end check of null row
        }

        // console.log(normalizedData);

        brain.convertToCSV(normalizedData, 'subcampaign_total');
    },
    convertToCSV: function(data, type) {
        const items = data.values
        const replacer = (key, value) => value === null ? '' : value // specify how you want to handle null values here
        const header = Object.keys(items[0])
        let csv = items.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
        csv.unshift(header.join(','))
        csv = csv.join('\r\n')
        
        brain.showResult(csv,type)
    },
    showResult: function(csvData, type) {
        var filename = type + '_' + moment().format('MMDDYY[_]hmmss') + '.csv';

        $('.result').show();
        // name = name.replace('csv', 'txt')
        $('#result').append('<p><a href="'+brain.makeTextFile(csvData)+'" download="'+filename+'" class="">Download '+filename+'</a>').show();

        // brain.config.recordData = ''; // clear data
        // brain.config.textData = ''; // clear data
        // brain.config.recordCount = 0;  // clear data
        // duplicate_count=0;
        // record_count=0;
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