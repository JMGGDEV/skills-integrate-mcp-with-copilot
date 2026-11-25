document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupContainer = document.getElementById("signup-container");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginButton = document.getElementById("login-button");
  const teacherAccount = document.getElementById("teacher-account");
  const teacherUsername = document.getElementById("teacher-username");
  const logoutButton = document.getElementById("logout-button");
  const loginDialog = document.getElementById("login-dialog");
  const loginForm = document.getElementById("login-form");
  const closeLoginButton = document.getElementById("close-login");
  const authMessage = document.getElementById("auth-message");
  let isTeacher = false;

  function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type}`;
    setTimeout(() => element.classList.add("hidden"), 5000);
  }

  function updateTeacherControls(session) {
    isTeacher = session.authenticated;
    loginButton.classList.toggle("hidden", isTeacher);
    teacherAccount.classList.toggle("hidden", !isTeacher);
    signupContainer.hidden = !isTeacher;
    teacherUsername.textContent = isTeacher ? session.username : "";
  }

  async function refreshSession() {
    const response = await fetch("/auth/session");
    const session = await response.json();
    if (!response.ok) {
      throw new Error(session.detail || "Unable to check teacher sign-in.");
    }
    updateTeacherControls(session);
  }

  function createActivityCard(name, details) {
    const activityCard = document.createElement("div");
    activityCard.className = "activity-card";

    const title = document.createElement("h4");
    title.textContent = name;
    activityCard.appendChild(title);

    const description = document.createElement("p");
    description.textContent = details.description;
    activityCard.appendChild(description);

    const schedule = document.createElement("p");
    const scheduleLabel = document.createElement("strong");
    scheduleLabel.textContent = "Schedule: ";
    schedule.append(scheduleLabel, document.createTextNode(details.schedule));
    activityCard.appendChild(schedule);

    const availability = document.createElement("p");
    const availabilityLabel = document.createElement("strong");
    availabilityLabel.textContent = "Availability: ";
    availability.append(
      availabilityLabel,
      document.createTextNode(
        `${details.max_participants - details.participants.length} spots left`
      )
    );
    activityCard.appendChild(availability);

    const participantsContainer = document.createElement("div");
    participantsContainer.className = "participants-container";
    if (details.participants.length > 0) {
      const participantsSection = document.createElement("div");
      participantsSection.className = "participants-section";

      const participantsHeading = document.createElement("h5");
      participantsHeading.textContent = "Participants:";
      participantsSection.appendChild(participantsHeading);

      const participantsList = document.createElement("ul");
      participantsList.className = "participants-list";
      details.participants.forEach((email) => {
        const participant = document.createElement("li");
        const emailLabel = document.createElement("span");
        emailLabel.className = "participant-email";
        emailLabel.textContent = email;
        participant.appendChild(emailLabel);

        if (isTeacher) {
          const unregisterButton = document.createElement("button");
          unregisterButton.className = "delete-btn";
          unregisterButton.type = "button";
          unregisterButton.textContent = "Remove";
          unregisterButton.dataset.activity = name;
          unregisterButton.dataset.email = email;
          unregisterButton.addEventListener("click", handleUnregister);
          participant.appendChild(unregisterButton);
        }

        participantsList.appendChild(participant);
      });

      participantsSection.appendChild(participantsList);
      participantsContainer.appendChild(participantsSection);
    } else {
      const noParticipants = document.createElement("p");
      noParticipants.innerHTML = "<em>No participants yet</em>";
      participantsContainer.appendChild(noParticipants);
    }
    activityCard.appendChild(participantsContainer);
    return activityCard;
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      if (!response.ok) {
        throw new Error("Unable to load activities.");
      }
      const activities = await response.json();
      activitiesList.replaceChildren();
      activitySelect.replaceChildren(new Option("-- Select an activity --", ""));

      Object.entries(activities).forEach(([name, details]) => {
        activitiesList.appendChild(createActivityCard(name, details));

        const option = new Option(name, name);
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.textContent =
        "Failed to load activities. Please try again later.";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.currentTarget;
    const activity = button.dataset.activity;
    const email = button.dataset.email;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );
      const result = await response.json();

      if (response.status === 401) {
        await refreshSession();
        showMessage(authMessage, "Your teacher session has expired. Please sign in again.", "error");
        loginDialog.showModal();
        return;
      }
      if (!response.ok) {
        showMessage(messageDiv, result.detail || "Unable to unregister student.", "error");
        return;
      }

      showMessage(messageDiv, result.message, "success");
      await fetchActivities();
    } catch (error) {
      showMessage(messageDiv, "Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isTeacher) {
      return;
    }

    const email = document.getElementById("email").value;
    const activity = activitySelect.value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        { method: "POST" }
      );
      const result = await response.json();

      if (response.status === 401) {
        await refreshSession();
        showMessage(authMessage, "Your teacher session has expired. Please sign in again.", "error");
        loginDialog.showModal();
        return;
      }
      if (!response.ok) {
        showMessage(messageDiv, result.detail || "Unable to register student.", "error");
        return;
      }

      showMessage(messageDiv, result.message, "success");
      signupForm.reset();
      await fetchActivities();
    } catch (error) {
      showMessage(messageDiv, "Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginButton.addEventListener("click", () => {
    authMessage.classList.add("hidden");
    loginDialog.showModal();
  });

  closeLoginButton.addEventListener("click", () => loginDialog.close());

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        showMessage(authMessage, result.detail || "Unable to sign in.", "error");
        return;
      }

      loginForm.reset();
      loginDialog.close();
      await refreshSession();
      await fetchActivities();
    } catch (error) {
      showMessage(authMessage, "Failed to sign in. Please try again.", "error");
      console.error("Error signing in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Unable to sign out.");
      }
      updateTeacherControls({ authenticated: false, username: null });
      await fetchActivities();
    } catch (error) {
      showMessage(messageDiv, "Failed to sign out. Please try again.", "error");
      console.error("Error signing out:", error);
    }
  });

  async function initialize() {
    try {
      await refreshSession();
    } catch (error) {
      updateTeacherControls({ authenticated: false, username: null });
      console.error("Error checking teacher session:", error);
    }
    await fetchActivities();
  }

  initialize();
});
