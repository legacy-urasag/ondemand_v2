// Google Apps Script for OnDemand Form Submissions
// Deploy this as a web app and replace the URL in your HTML file

const LICENSES_FOLDER_ID = '1irUQdceu991bLJJi0Tr1tTe0ImEak';

function doPost(e) {
  try {
    console.log('POST request received');
    console.log('Event object:', e);
    
    // Prefer e.parameter for FormData; fall back to postData
    if (!e) {
      console.error('No event object');
      return ContentService
        .createTextOutput(JSON.stringify({ 'result': 'error', 'error': 'No event object received' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    let formType, formData;

    if (e.parameter && Object.keys(e.parameter).length) {
      // Handle standard form submission (FormData or URL-encoded)
      console.log('Parsing via e.parameter');
      formType = e.parameter.formType;
      const dataParam = e.parameter.data;
      try {
        formData = dataParam ? JSON.parse(dataParam) : null;
      } catch (paramParseErr) {
        console.error('Failed to parse e.parameter.data JSON:', paramParseErr);
        formData = null;
      }
    } else if (e.postData && e.postData.contents) {
      // Fallback: try JSON in body
      console.log('Parsing via e.postData.contents');
      try {
        const jsonData = JSON.parse(e.postData.contents);
        formType = jsonData.formType;
        formData = jsonData.data;
      } catch (jsonErr) {
        console.error('Failed to parse postData JSON:', jsonErr);
      }
    } else {
      console.error('No post data received');
      return ContentService
        .createTextOutput(JSON.stringify({ 'result': 'error', 'error': 'No post data received' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    console.log('Parsed data:', { formType, formData });

    if (!formType || !formData) {
      console.error('Missing formType or data after parsing');
      return ContentService
        .createTextOutput(JSON.stringify({ 'result': 'error', 'error': 'Missing formType or data' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    console.log('Parsed data:', { formType, formData });
    
    if (!formType || !formData) {
      console.error('Missing formType or data');
      return ContentService
        .createTextOutput(JSON.stringify({ 'result': 'error', 'error': 'Missing formType or data' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get the appropriate spreadsheet
    let spreadsheet;
    try {
      if (formType === 'customer') {
        // Customer spreadsheet ID - replace with your actual spreadsheet ID
        spreadsheet = SpreadsheetApp.openById('1grxbyN46WL12V0jmeLRUQ0FrpUmmpTX90tWQhSYEJ24');
        console.log('Customer spreadsheet opened successfully');
      } else if (formType === 'freelancer') {
        // Freelancer spreadsheet ID - replace with your actual spreadsheet ID
        spreadsheet = SpreadsheetApp.openById('1heowmSTCdbxUFjT_eqPMajMyMRZOOVelCQ1bBmfe4kI');
        console.log('Freelancer spreadsheet opened successfully');
      } else {
        throw new Error('Invalid form type: ' + formType);
      }
    } catch (spreadsheetError) {
      console.error('Error opening spreadsheet:', spreadsheetError);
      throw new Error('Cannot access spreadsheet. Please check permissions and try again.');
    }
    
    // Get the first sheet
    const sheet = spreadsheet.getSheets()[0];
    console.log('Sheet name:', sheet.getName());
    
    // Check if headers exist, if not create them
    if (sheet.getRange(1, 1).getValue() === '') {
      console.log('Creating headers for', formType, 'sheet');
      createHeaders(sheet, formType);
    }
    
    // Prepare row data based on form type
    let rowData = [];
    
    if (formType === 'customer') {
      rowData = [
        formData.timestamp,
        formData.name,
        formData.email,
        formData.phone,
        formData.location,
        formData.jobType,
        formData.urgency,
        formData.description
      ];
    } else if (formType === 'freelancer') {
      // If a base64 file was provided, save it to Drive and create a public preview URL
      let licensePublicUrl = '';
      try {
        if (formData.licenseFileBase64) {
          const bytes = Utilities.base64Decode(formData.licenseFileBase64);
          const contentType = formData.licenseFileType || 'application/octet-stream';
          const filename = formData.licenseFileName || 'license';
          const blob = Utilities.newBlob(bytes, contentType, filename);
          let folder;
          try {
            folder = DriveApp.getFolderById(LICENSES_FOLDER_ID);
          } catch (folderErr) {
            console.warn('Invalid LICENSES_FOLDER_ID, using root folder instead');
            folder = DriveApp.getRootFolder();
          }
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          const fileId = file.getId();
          licensePublicUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
          console.log('Saved license file to Drive with id:', fileId);
        }
      } catch (driveErr) {
        console.error('Failed to save license file to Drive:', driveErr);
      }

      const imageCell = licensePublicUrl
        ? '=IMAGE("' + licensePublicUrl + '")'
        : (formData.licenseFileName || '');

      rowData = [
        formData.timestamp,
        formData.name,
        formData.email,
        formData.phone,
        Array.isArray(formData.trade) ? formData.trade.join(', ') : formData.trade,
        formData.experience,
        formData.areas,
        imageCell
      ];
    }
    
    console.log('Adding row data:', rowData);
    
    // Append the data to the sheet
    sheet.appendRow(rowData);
    
    console.log('Successfully added data to sheet');
    
    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'success', 'message': 'Data saved successfully' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error in doPost:', error);
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'error', 'error': error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function createHeaders(sheet, formType) {
  try {
    if (formType === 'customer') {
      const customerHeaders = [
        'Timestamp',
        'Name',
        'Email', 
        'Phone',
        'Location',
        'Job Type',
        'Urgency',
        'Description'
      ];
      sheet.getRange(1, 1, 1, customerHeaders.length).setValues([customerHeaders]);
      sheet.getRange(1, 1, 1, customerHeaders.length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, customerHeaders.length).setBackground('#f3f4f6');
      console.log('Customer headers created successfully');
    } else if (formType === 'freelancer') {
      const freelancerHeaders = [
        'Timestamp',
        'Name',
        'Email',
        'Phone',
        'Trade',
        'Experience',
        'Areas',
        'License File'
      ];
      sheet.getRange(1, 1, 1, freelancerHeaders.length).setValues([freelancerHeaders]);
      sheet.getRange(1, 1, 1, freelancerHeaders.length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, freelancerHeaders.length).setBackground('#f3f4f6');
      console.log('Freelancer headers created successfully');
    }
  } catch (error) {
    console.error('Error creating headers:', error);
    throw error;
  }
}

function doGet(e) {
  // Handle GET requests (optional - for testing)
  return ContentService
    .createTextOutput('OnDemand Forms API is running')
    .setMimeType(ContentService.MimeType.TEXT);
}

// Manual setup function - you can run this once to set up your spreadsheets
function setupSpreadsheets() {
  try {
    console.log('Starting spreadsheet setup...');
    
    // Setup Customer Spreadsheet
    console.log('Setting up customer spreadsheet...');
    const customerSpreadsheet = SpreadsheetApp.openById('1grxbyN46WL12V0jmeLRUQ0FrpUmmpTX90tWQhSYEJ24');
    console.log('Customer spreadsheet name:', customerSpreadsheet.getName());
    const customerSheet = customerSpreadsheet.getSheets()[0];
    createHeaders(customerSheet, 'customer');
    console.log('Customer spreadsheet headers created');
    
    // Setup Freelancer Spreadsheet
    console.log('Setting up freelancer spreadsheet...');
    const freelancerSpreadsheet = SpreadsheetApp.openById('1heowmSTCdbxUFjT_eqPMajMyMRZOOVelCQ1bBmfe4kI');
    console.log('Freelancer spreadsheet name:', freelancerSpreadsheet.getName());
    const freelancerSheet = freelancerSpreadsheet.getSheets()[0];
    createHeaders(freelancerSheet, 'freelancer');
    console.log('Freelancer spreadsheet headers created');
    
    console.log('Both spreadsheets setup complete!');
    return 'Both spreadsheets setup complete!';
  } catch (error) {
    console.error('Error setting up spreadsheets:', error);
    throw error;
  }
}

// Test function to verify spreadsheet access
function testSpreadsheetAccess() {
  try {
    console.log('Testing customer spreadsheet access...');
    const customerSpreadsheet = SpreadsheetApp.openById('1grxbyN46WL12V0jmeLRUQ0FrpUmmpTX90tWQhSYEJ24');
    console.log('Customer spreadsheet name:', customerSpreadsheet.getName());
    
    console.log('Testing freelancer spreadsheet access...');
    const freelancerSpreadsheet = SpreadsheetApp.openById('1heowmSTCdbxUFjT_eqPMajMyMRZOOVelCQ1bBmfe4kI');
    console.log('Freelancer spreadsheet name:', freelancerSpreadsheet.getName());
    
    console.log('Spreadsheet access test completed successfully!');
    return 'Spreadsheet access verified successfully!';
  } catch (error) {
    console.error('Spreadsheet access test failed:', error);
    throw error;
  }
}

// Simple test function to check basic functionality
function simpleTest() {
  try {
    console.log('Running simple test...');
    const testData = { test: 'Hello World' };
    console.log('Test data:', testData);
    return 'Simple test completed successfully!';
  } catch (error) {
    console.error('Simple test failed:', error);
    throw error;
  }
} 