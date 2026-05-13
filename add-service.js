import { supabase } from './supabase.js';
import { LoadingSpinner } from './loading-utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const addServiceForm = document.getElementById('add-service-form');
    const backBtn = document.getElementById('backBtn');

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            LoadingSpinner.navigateTo('browse.html');
        });
    }

    if (addServiceForm) {
        addServiceForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                alert("You must be logged in to add a service.");
                LoadingSpinner.navigateTo('login.html');
                return;
            }

            const category = document.getElementById('service-category').value;
            if (!category) {
                alert("Please select a category.");
                return;
            }

            const priceValue = document.getElementById('service-price').value.trim();
            if (!priceValue || isNaN(parseFloat(priceValue))) {
                alert("Please enter a valid price.");
                return;
            }

            let providerName = 'Anonymous';
            try {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('full_name')
                    .eq('uid', user.id)
                    .single();

                if (!userError && userData) {
                    providerName = userData.full_name || 'Anonymous';
                }
            } catch (error) {
                console.warn('Could not fetch user data:', error);
            }

            const serviceData = {
                provider_id: user.id,
                title: document.getElementById('service-title').value.trim(),
                description: document.getElementById('service-description').value.trim(),
                category: category,
                price: parseFloat(priceValue),
                location: document.getElementById('service-location').value.trim()
            };

            try {
                console.log('Adding service with data:', serviceData);
                const { data, error } = await supabase
                    .from('services')
                    .insert([serviceData])
                    .select();

                if (error) {
                    throw error;
                }

                console.log('Service added with ID:', data[0].id);
                alert("Service added successfully!");
                LoadingSpinner.navigateTo('my-services.html');
            } catch (error) {
                console.error("Error adding service: ", error);
                alert(`Error adding service: ${error.message}`);
            }
        });
    }
});