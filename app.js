import express from "express";
import cors from "cors";
import { db } from "./config.js";  // Ensure this is importing correctly
import { addDoc, getDocs, where, query, collection, doc, getDoc, updateDoc, setDoc, arrayUnion   } from 'firebase/firestore'; 
import bcrypt from 'bcrypt';

const app = express();
app.use(express.json());
app.use(cors());

const Login = collection(db, "Login");
const Doctor = collection(db, "Doctor");
const DoctorAppointment = collection(db, "DoctorAppointment");



//////////////////////// Registration and login ///////////////////////////////

app.post('/register', async (req, res) => {
    const { uid, name, email, is_doctor } = req.body;
  
    try {
      // Save user details to Firestore
      await setDoc(doc(db, 'Login', uid), {
        name,
        email,
        is_doctor,
      });
  
      res.status(200).send({ message: 'User registered successfully' });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).send({ message: 'Registration failed', error });
    }
  });



app.post("/login", async (req, res) => {
    const { email } = req.body;
    console.log("Data of users login: ", req.body);

    try {
        // Query Firestore to check if the email exists in the Login collection
        const q = query(Login, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        // If the query returns any documents, it means the email exists
        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            console.log("userData:", userData); // Check the userData object

            if (userData) {
                if(userData.is_doctor === true){
                    res.status(200).json({ message: "Doctor Login successful", name: userData.name, email: userData.email  });
                }else{
                    res.status(200).json({ message: "Patient Login successful", name: userData.name, email: userData.email  });
                }  
            } else {
                res.status(401).json({ message: "Incorrect password. Login failed" });
            }
        } else {
            res.status(401).json({ message: "Email not found. Login failed" });
        }
    } catch (err) {
        console.log("Error checking email in Login collection: ", err);
        res.status(500).json({ message: "Login failed" });
    }
});



////////////////////////// Patient side ///////////////////////////////////////
////////////////fetching doctor data for patient home page/////////////////////
app.get("/fetchalldoctor", async (req, res) => {
    try {
        const drData = await getDocs(Doctor); // Use getDocs function to get snapshot of all documents
        const list = drData.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log("Fetched data is: ", list);
        res.status(200).json({ message: "Successfully fetched doctors", list });
    } catch (err) {
        console.log("Error fetching document: ", err);
        res.status(500).json({ message: "Data not fetched", error: err });
    }
});

////////////////fetch the searched doctor ////////////////////////////
app.post("/searchDoctor", async (req, res) => {
    const { firstName, lastName } = req.body;
    console.log("Data of users login: ", req.body);
    
    try {
        // Convert search terms to lowercase for case-insensitive search
       
        
        // Query Firestore to check if the doctor exists
        const q = query(Doctor, where("firstName", "==", firstName), where("lastName", "==", lastName));
        console.log("Firestore query: ", q); // Log the Firestore query
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const doctorData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log("Doctor data found: ", doctorData);
            res.status(200).json({ message: "Doctor data found", data: doctorData });
        } else {
            console.log("No doctor found with the provided details");
            res.status(404).json({ message: "No doctor found with the provided details" });
        }
    } catch (err) {
        console.log("Error fetching searched doctor: ", err);
        res.status(500).json({ message: "Error fetching searched doctor", error: err });
    }
});


////////////////patient booking the appointment//////////////////////////

app.post('/checkBookedSlots', async (req, res) => {
    const { date, email } = req.body;
  
    try {
      // Query Firestore to check if the doctor exists
    //   const doctorsRef = collection(firestore, 'Doctor');
      const q = query(Doctor, where("email", "==", email));
      const querySnapshot = await getDocs(q);
  
      if (querySnapshot.empty) {
        return res.status(404).send('Doctor not found');
      }
  
      // Assuming email is unique, so we take the first document
      const doctorDoc = querySnapshot.docs[0];
      const doctorData = doctorDoc.data();
  
      // Get booked slots and available slots
      const bookedSlots = doctorData.bookedSlots || {};
      const availableSlots = doctorData.availableSlots || [];
  
      // Get the booked slots for the specified date
      const unavailableSlots = bookedSlots[date] || [];
  
      // Compare and find the matching slots
      const matchingSlots = availableSlots.filter(slot => unavailableSlots.includes(slot));
  
      return res.status(200).json({ matchingSlots });
    } catch (error) {
      console.error('Error checking booked slots:', error);
      return res.status(500).send('Internal Server Error');
    }
  });

// Route to handle booking an appointment
app.post("/bookingAppointment", async (req, res) => {
    const appointmentData = req.body;

    // Add status field to the appointment data
    const appointmentWithStatus = {
        ...appointmentData,
        status: "pending"  // Setting the default status as "pending"
    };

    console.log("Data of users including status: ", appointmentWithStatus);

    try {
        // Add the document with status to the DoctorAppointment collection
        const docRef = await addDoc(DoctorAppointment, appointmentWithStatus);
        console.log("Document written with ID: ", docRef.id);

        // Update the bookedSlots field in the Doctor collection
        const doctorQuery = query(Doctor, where("email", "==", appointmentData.email));
        const querySnapshot = await getDocs(doctorQuery);

        if (!querySnapshot.empty) {
            const doctorDoc = querySnapshot.docs[0];
            const doctorRef = doc(Doctor, doctorDoc.id);
            const doctorData = doctorDoc.data();
            let bookedSlots = doctorData.bookedSlots || {};

            // Check if the date already exists in bookedSlots
            const appointmentDate = appointmentData.date;
            const timeSlot = appointmentData.timeSlot;

            if (bookedSlots[appointmentDate]) {
                // If the date exists, add the timeSlot to the array if it's not already present
                if (!bookedSlots[appointmentDate].includes(timeSlot)) {
                    bookedSlots[appointmentDate].push(timeSlot);
                }
            } else {
                // If the date does not exist, create a new array for that date
                bookedSlots[appointmentDate] = [timeSlot];
            }

            await updateDoc(doctorRef, {
                bookedSlots: bookedSlots
            });

            console.log("Doctor's booked slots updated.", bookedSlots);
        } else {
            console.log("No doctor found with the provided email.");
        }

        res.status(201).json({ message: "Successfully appointment submitted", id: docRef.id });
    } catch (err) {
        console.log("Error adding document: ", err);
        res.status(500).json({ message: "Data not saved" });
    }
});


////////fetching the appinotment for  patient/////////////////
app.post("/fetchingAppointment", async (req, res) => {
    const { patientEmail } = req.body; // Destructure email from req.body
    console.log("Data of user's login: ", req.body);

    try {
        // Query Firestore to check if the email exists in the DoctorAppointment collection
        const q = query(DoctorAppointment, where("patientEmail", "==", patientEmail));
        const querySnapshot = await getDocs(q);
        
        const appointments = []; // Array to store fetched appointments

        // Iterate over the querySnapshot to extract data and document IDs
        querySnapshot.forEach((doc) => {
            // Get data from each document
            const appointmentData = doc.data();
            const appointmentWithId = { id: doc.id, ...appointmentData }; // Include document ID with appointment data
            appointments.push(appointmentWithId); // Push the data into the appointments array
        });

        console.log("Data is: ", appointments);

        res.status(200).json({ appointments }); // Send the appointments data in the response
    } catch (err) {
        console.log("Error fetching appointments: ", err);
        res.status(500).json({ message: "Failed to fetch appointments" });
    }
});







////////////////////////// Doctor Side ////////////////////////////////////////
///////////create doctor account///////////////////
app.post("/addDoctor", async (req, res) => {
    const doctorData  = req.body;
    console.log("Data of users: ", req.body);

    try {
        // Add the document to the Login collection
        const docRef = await addDoc(Doctor, doctorData);
        console.log("Document written with ID: ", docRef.id);
        res.status(201).json({ message: "Successfully add doctor", id: docRef.id });
    } catch (err) {
        console.log("Error adding document: ", err);
        res.status(500).json({ message: "data not saved" });
    }
});

app.post("/getdoctorprofile", async(req,res) => {
    const { first_name, last_name } = req.body;
    console.log("Data of users login: ", req.body);
    
    try {
        // Query Firestore to check if the doctor exists
        const q = query(Doctor, where("first_name", "==", first_name), where("last_name", "==", last_name));
        console.log("Firestore query: ", q); // Log the Firestore query
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const doctorData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log("Doctor data found: ", doctorData);
            res.status(200).json({ message: "Doctor data found", data: doctorData });
        } else {
            console.log("No doctor found with the provided details");
            res.status(404).json({ message: "No doctor found with the provided details" });
        }
    } catch (err) {
        console.log("Error fetching searched doctor: ", err);
        res.status(500).json({ message: "Error fetching searched doctor", error: err });
    }
})

app.patch("/updateDoctor", async (req, res) => {
    const doctorId = req.body.id;
    const updatedData  = req.body;
    console.log("Data for updating doctor with ID ", doctorId, ": ", updatedData);

    try {
        // Fetch the document to update
        const doctorRef = doc(Doctor, doctorId);
        const doctorSnapshot = await getDoc(doctorRef);

        if (!doctorSnapshot.exists()) {
            console.log("Doctor not found");
            return res.status(404).json({ message: "Doctor not found" });
        }

        // Update the document with the new data
        await updateDoc(doctorRef, updatedData);

        console.log("Doctor updated successfully");
        res.status(200).json({ message: "Doctor updated successfully" });
    } catch (err) {
        console.log("Error updating doctor: ", err);
        res.status(500).json({ message: "Error updating doctor", error: err });
    }
});


app.post("/fetchingAllAppointment", async (req, res) => {
    const { email } = req.body; // Destructure email from req.body
    console.log("Data of user's login: ", req.body);

    try {
        // Query Firestore to check if the email exists in the DoctorAppointment collection
        const q = query(DoctorAppointment, where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        const appointments = []; // Array to store fetched appointments

        // Iterate over the querySnapshot to extract data and document IDs
        querySnapshot.forEach((doc) => {
            // Get data from each document
            const appointmentData = doc.data();
            const appointmentWithId = { id: doc.id, ...appointmentData }; // Include document ID with appointment data
            appointments.push(appointmentWithId); // Push the data into the appointments array
        });

        console.log("Data is: ", appointments);

        res.status(200).json({ appointments }); // Send the appointments data in the response
    } catch (err) {
        console.log("Error fetching appointments: ", err);
        res.status(500).json({ message: "Failed to fetch appointments" });
    }
});

app.post("/fetchingDoctorprofile", async (req, res) => {
    const { email } = req.body; // Destructure email from req.body
    console.log("Data of user's login: ", req.body);

    try {
        // Query Firestore to check if the email exists in the DoctorAppointment collection
        const q = query(Doctor, where("email", "==", email));
        const querySnapshot = await getDocs(q);
    
        if (!querySnapshot.empty) {
            const doctorProfile = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log("Doctor data found: ", doctorProfile);
            res.status(200).json({ message: "Doctor data found", data: doctorProfile });
        } else {
            console.log("No doctor found with the provided details");
            res.status(404).json({ message: "No doctor found with the provided details" });
        }
    } catch (err) {
        console.log("Error fetching profile: ", err);
        res.status(500).json({ message: "Failed to fetch profile" });
    }
});

app.patch("/updatebooking", async (req, res) => {
    const doctorId = req.body.id;
    const { status } = req.body;
    console.log("Data for updating doctor with ID ", doctorId, ": ", status);

    try {
        // Fetch the document to update
        const doctorRef = doc(db, 'DoctorAppointment', doctorId); // assuming db is your Firestore instance
        const doctorSnapshot = await getDoc(doctorRef);

        if (!doctorSnapshot.exists()) {
            console.log("Doctor not found");
            return res.status(404).json({ message: "Doctor not found" });
        }

        // Update the document with the new data
        await updateDoc(doctorRef, {
            status: status // Assuming 'status' is the field to be updated
        });

        console.log("Booking status updated successfully");
        res.status(200).json({ message: "Booking status updated successfully" });
    } catch (err) {
        console.log("Error updating status: ", err);
        res.status(500).json({ message: "Error updating status", error: err });
    }
});







app.listen(5000, () => {
    console.log("Server is running on port 5000");
});