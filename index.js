import { LoadingSpinner } from './loading-utils.js';
import { supabase } from './supabase.js';

// ================= UI =================
const servicesGrid = document.getElementById('servicesGrid');
const searchInput = document.getElementById('indexSearchInput');
const searchButton = document.getElementById('indexSearchBtn');
const guestActions = document.getElementById('guestActions');
const userActions = document.getElementById('userActions');
const mobileGuestActions = document.getElementById('mobileGuestActions');
const mobileUserActions = document.getElementById('mobileUserActions');
const logoutBtn = document.getElementById('logoutBtn');
const logoutBtnSideMenu = document.getElementById('logoutBtnSideMenu');

let allServices = [];

// ================= INIT =================
document.addEventListener('DOMContentLoaded', async () => {
    // Redirect to home.html if user is already logged in
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            window.location.href = 'home.html';
            return;
        }

        if (guestActions) guestActions.classList.remove('hidden');
        if (mobileGuestActions) mobileGuestActions.classList.remove('hidden');
        if (userActions) userActions.classList.add('hidden');
        if (mobileUserActions) mobileUserActions.classList.add('hidden');
    });
    await loadServices();
    setupEvents();
});

// ================= LOAD SERVICES =================
async function loadServices() {
    try {
        // Load services from Supabase
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .limit(8); // Show 8 featured services

        if (error) throw error;

        const services = data.map(service => ({
            id: service.id,
            ...service,
            providerName: service.provider_name || 'N/A'
        }));

        console.log('Loaded services from Supabase:', services.length);
        allServices = services;
        renderServices(allServices);

    } catch (error) {
        console.error('Error loading services:', error);
        servicesGrid.innerHTML = `
            <p class="col-span-full text-center text-red-500">
                Failed to load services.
            </p>
        `;
    }
}

// ================= RENDER =================
function renderServices(services) {
    servicesGrid.innerHTML = '';

    if (services.length === 0) {
        servicesGrid.innerHTML = `
            <p class="text-center col-span-3 text-gray-500">
                No services found.
            </p>
        `;
        return;
    }

    services.forEach(service => {
        const price = Number(service.price) || 0;

        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-lg shadow hover:shadow-md transition";

        card.innerHTML = `
            <h3 class="text-lg font-bold mb-2">${service.title || 'Untitled'}</h3>
            <p class="text-gray-600 mb-2">${service.providerName || 'Provider'}</p>
            <p class="text-green-600 font-semibold mb-3">NGN ${price.toLocaleString()}</p>
            <button 
                class="bg-blue-600 text-white px-4 py-2 rounded w-full"
                onclick="viewService('${service.id}')"
            >
                View Details
            </button>
        `;

        servicesGrid.appendChild(card);
    });
}

// ================= SEARCH + FILTER =================
function setupEvents() {
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            const searchTerm = searchInput.value.trim();
            if (searchTerm) {
                window.location.href = `browse.html?search=${encodeURIComponent(searchTerm)}`;
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const searchTerm = searchInput.value.trim();
                if (searchTerm) {
                    window.location.href = `browse.html?search=${encodeURIComponent(searchTerm)}`;
                }
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        });
    }

    if (logoutBtnSideMenu) {
        logoutBtnSideMenu.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        });
    }
}

// ================= CATEGORIES =================
function populateCategories() {
    const categories = new Set();

    allServices.forEach(service => {
        if (service.category) categories.add(service.category);
    });

    categorySelect.innerHTML = `<option value="all">All Categories</option>`;

    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
}

// ================= NAVIGATION (AUTH GUARD) =================
window.viewService = function(serviceId) {
    const redirectUrl = `service.html?id=${serviceId}`;
    LoadingSpinner.navigateTo(redirectUrl);
};