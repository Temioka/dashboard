(async function() {
  // Ensure ApiService is properly defined
  const api = window.apiService;
  if (!api) {
    console.error('Сервис ApiService не определен');
    return;
  }

  // Function to show notifications
  function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }

  // Load general settings (example GET /api/settings/general)
  async function loadGeneralSettings() {
    try {
      const response = await api.get('/api/settings/general');
      if (!response.ok) {
        throw new Error(`Ошибка загрузки общих настроек: ${response.statusText}`);
      }
      const data = await response.json();
      fillGeneralSettingsForm(data);
    } catch (error) {
      console.error('loadGeneralSettings:', error);
      showNotification('Не удалось загрузить общие настройки', 'error');;
    }
  }

  // Fill general settings form
  function fillGeneralSettingsForm(settings) {
    const systemNameEl = document.getElementById('systemName');
    const adminEmailEl = document.getElementById('adminEmail');
    if (systemNameEl && settings.systemName) {
      systemNameEl.value = settings.systemName;
    }
    if (adminEmailEl && settings.adminEmail) {
      adminEmailEl.value = settings.adminEmail;
    }
  }

  // Save general settings (example POST /api/settings/general)
  async function saveGeneralSettings() {
    try {
      const systemNameEl = document.getElementById('systemName');
      const adminEmailEl = document.getElementById('adminEmail');
      const payload = {
        systemName: systemNameEl?.value || '',
        adminEmail: adminEmailEl?.value || '',
      };
      const response = await api.post('/api/settings/general', payload);
      const result = await response.json();
      if (response.ok && result.success) {
        showNotification('Общие настройки успешно сохранены', 'success');
      } else {
        showNotification(result.message || 'Ошибка при сохранении настроек', 'error');
      }
    } catch (error) {
      console.error('saveGeneralSettings:', error);
      showNotification('Не удалось сохранить общие настройки', 'error');
    }
  }

  // Load admin profile (GET /api/admin/profile)
  async function loadAdminProfile() {
    try {
      const response = await api.get('/api/admin/profile');
      if (!response.ok) {
        throw new Error(`Ошибка загрузки профиля администратора:: ${response.statusText}`);
      }
      const profile = await response.json();
      renderAdminProfile(profile);
    } catch (error) {
      console.error('loadAdminProfile:', error);
      showNotification('Не удалось загрузить профиль администратора', 'error');
    }
  }

  // Render admin profile
  function renderAdminProfile(profile) {
    const profileSection = document.querySelector('#profile .settings-section-content');
    if (!profileSection) return;

    profileSection.innerHTML = `
      <div class="profile-info">
        <img src="${profile.avatarUrl || 'https://randomuser.me/api/portraits/men/1.jpg'}" alt="Admin" class="profile-avatar">
        <div>
          <div class="profile-name">${profile.fullName || profile.username}</div>
          <div class="profile-email">${profile.email || ''}</div>
        </div>
      </div>
    `;
  }

  // Load users (GET /api/users)
  async function loadUsers() {
    try {
      const response = await api.get('/api/users');
      if (!response.ok) {
        throw new Error(`Ошибка загрузки списка пользователей: ${response.statusText}`);
      }
      const users = await response.json();
      renderUsers(users);
    } catch (error) {
      console.error('loadUsers:', error);
      showNotification('Не удалось загрузить список пользователей', 'error');
    }
  }

  // Render user table
  function renderUsers(users) {
    const tableBody = document.querySelector('#users table.settings-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    users.forEach((user) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="user-info">
            <img src="${user.avatarUrl || 'https://randomuser.me/api/portraits/men/1.jpg'}" alt="User" class="user-avatar">
            <div>
              <div class="user-name">${user.fullName || user.username}</div>
              <div class="user-email">${user.email || ''}</div>
            </div>
          </div>
        </td>
        <td>${user.username || ''}</td>
        <td><span class="role ${user.role || ''}">${translateRole(user.role)}</span></td>
        <td>${user.department || ''}</td>
        <td><span class="status ${user.isActive ? 'active' : 'inactive'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
        <td class="timestamp">${user.lastLogin || ''}</td>
        <td class="actions">
          <button class="action-btn edit" title="Edit" data-username="${user.username}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="action-btn delete" title="Delete" data-username="${user.username}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('.edit').forEach((editBtn) => {
      editBtn.addEventListener('click', (e) => {
        const username = e.currentTarget.getAttribute('data-username');
        editUserHandler(username);
      });
    });

    tableBody.querySelectorAll('.delete').forEach((deleteBtn) => {
      deleteBtn.addEventListener('click', (e) => {
        const username = e.currentTarget.getAttribute('data-username');
        deleteUserHandler(username);
      });
    });

    // Add user button
    document.querySelector('.add-user-btn').addEventListener('click', () => {
      showAddUserModal();
    });
  }

  function showAddUserModal() {
    const modal = document.getElementById('addUserModal');
    if (modal) {
      modal.style.display = 'block';
    }
  }

  function translateRole(role) {
    switch (role) {
      case 'admin': return 'Admin';
      case 'manager': return 'Manager';
      default: return 'User';
    }
  }

  function editUserHandler(username) {
    showNotification(`Editing user: ${username}`, 'info');
  }

  async function deleteUserHandler(username) {
    if (!confirm('Вы уверены что хотите удалить пользователя ?')) {
      return;
    }
    try {
      const response = await api.delete(`/api/users/${username}`);
      const result = await response.json();
      if (response.ok && result.success) {
        showNotification('Пользователь удален', 'success');
        loadUsers(); // Reload user list
      } else {
        showNotification(result.message || 'Ошибка при удалении пользователя', 'error');
      }
    } catch (error) {
      console.error('deleteUserHandler:', error);
      showNotification('Не удалось удалить пользователя', 'error');
    }
  }

  // Load roles (GET /api/roles)
  async function loadRoles() {
    try {
      const response = await api.get('/api/roles');
      if (!response.ok) {
        throw new Error(`Ошибка загрузки списка ролей: ${response.statusText}`);
      }
      const roles = await response.json();
      renderRoles(roles);
    } catch (error) {
      console.error('loadRoles:', error);
      showNotification('Не удалось загрузить список ролей', 'error');
    }
  }

  // Render role table
  function renderRoles(roles) {
    const tableBody = document.querySelector('#roles table.settings-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    roles.forEach((role) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${role.name}</td>
        <td>${role.description}</td>
        <td class="actions">
          <button class="action-btn edit" title="Edit" data-role="${role.name}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="action-btn delete" title="Delete" data-role="${role.name}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('.edit').forEach((editBtn) => {
      editBtn.addEventListener('click', (e) => {
        const roleName = e.currentTarget.getAttribute('data-role');
        editRoleHandler(roleName);
      });
    });

    tableBody.querySelectorAll('.delete').forEach((deleteBtn) => {
      deleteBtn.addEventListener('click', (e) => {
        const roleName = e.currentTarget.getAttribute('data-role');
        deleteRoleHandler(roleName);
      });
    });
  }

  function editRoleHandler(roleName) {
    showNotification(`Редактирование роли: ${roleName}`, 'info');
  }

  async function deleteRoleHandler(roleName) {
    if (!confirm('Вы уверены, что хотите удалить эту роль?')) {
      return;
    }
    try {
      const response = await api.delete(`/api/roles/${roleName}`);
      const result = await response.json();
      if (response.ok && result.success) {
        showNotification('Роль успешно удалена', 'success');
        loadRoles(); // Reload role list
      } else {
        showNotification(result.message || 'Ошибка при удалении роли', 'error');
      }
    } catch (error) {
      console.error('deleteRoleHandler:', error);
      showNotification('Не удалось удалить роль', 'error');
    }
  }

  // Load system status (GET /api/system/status)
  async function loadSystemStatus() {
    try {
      const response = await api.get('/api/system/status');
      if (!response.ok) {
        throw new Error(`Ошибка загрузки статуса системы: ${response.statusText}`);
      }
      const status = await response.json();
      renderSystemStatus(status);
    } catch (error) {
      console.error('loadSystemStatus:', error);
      showNotification('Не удалось загрузить статус системы', 'error');
    }
  }

  // Render system status
  function renderSystemStatus(status) {
    const statusSection = document.querySelector('#system .settings-panel-content');
    if (!statusSection) return;

    statusSection.innerHTML = `
      <div class="status-indicator">
        <span class="status-badge ${status.isOnline ? 'online' : 'offline'}"></span>
        <span class="status-text ${status.isOnline ? 'online' : 'offline'}">${status.isOnline ? 'System is operating normally' : 'System is offline'}</span>
      </div>
      <div class="status-detail">
        Last check: <span class="timestamp">${new Date(status.lastCheck).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}</span> | 
        Uptime: ${status.uptime}
      </div>
      <div class="system-info-grid">
        <div class="system-info-card">
          <div class="system-info-title">CPU Load</div>
          <div class="system-info-value">
            <i class="fas fa-microchip"></i>
            ${status.cpuLoad}%
          </div>
          <div class="progress-container">
            <div class="progress-bar normal" style="width: ${status.cpuLoad}%"></div>
          </div>
          <div class="progress-details">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
        <div class="system-info-card">
          <div class="system-info-title">Memory Usage</div>
          <div class="system-info-value">
            <i class="fas fa-memory"></i>
            ${status.memoryUsed} / ${status.memoryTotal} GB
          </div>
          <div class="progress-container">
            <div class="progress-bar normal" style="width: ${(status.memoryUsed / status.memoryTotal) * 100}%"></div>
          </div>
          <div class="progress-details">
            <span>0 GB</span>
            <span>${status.memoryTotal} GB</span>
          </div>
        </div>
        <div class="system-info-card">
          <div class="system-info-title">Disk Space</div>
          <div class="system-info-value">
            <i class="fas fa-hdd"></i>
            ${status.diskUsed} / ${status.diskTotal} GB
          </div>
          <div class="progress-container">
            <div class="progress-bar ${status.diskUsed / status.diskTotal > 0.75 ? 'warning' : 'normal'}" style="width: ${(status.diskUsed / status.diskTotal) * 100}%"></div>
          </div>
          <div class="progress-details">
            <span>0 GB</span>
            <span>${status.diskTotal} GB</span>
          </div>
        </div>
        <div class="system-info-card">
          <div class="system-info-title">Database</div>
          <div class="system-info-value">
            <i class="fas fa-database"></i>
            ${status.databaseSize} GB
          </div>
          <div class="system-info-desc">
            Last optimization: ${new Date(status.lastOptimization).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}<br>
            Last backup: <span class="timestamp">${new Date(status.lastBackup).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Load notifications (GET /api/notifications)
  async function loadNotifications() {
    try {
      const response = await api.get('/api/notifications');
      if (!response.ok) {
        throw new Error(`Ошибка загрузки уведомлений:: ${response.statusText}`);
      }
      const notifications = await response.json();
      renderNotifications(notifications);
    } catch (error) {
      console.error('loadNotifications:', error);
      showNotification('Не удалось загрузить уведомления', 'error');
    }
  }

  // Render notifications
  function renderNotifications(notifications) {
    const notificationsContainer = document.querySelector('.system-notifications');
    if (!notificationsContainer) return;

    notificationsContainer.innerHTML = '';
    notifications.forEach((notification) => {
      const notificationItem = document.createElement('div');
      notificationItem.className = `notification-item ${notification.type}`;
      notificationItem.innerHTML = `
        <div class="notification-header">
          <div class="notification-title">${notification.title}</div>
          <div class="notification-time timestamp">${new Date(notification.timestamp).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}</div>
        </div>
        <div class="notification-message">
          ${notification.message}
        </div>
        <div class="notification-actions">
          <a href="#" class="notification-action">${notification.actionText}</a>
        </div>
      `;
      notificationsContainer.appendChild(notificationItem);
    });
  }

  function initSettingsTabs() {
    const navLinks = document.querySelectorAll('.settings-nav-link');
    const sections = document.querySelectorAll('.settings-section');

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();

        navLinks.forEach(lnk => lnk.classList.remove('active'));
        link.classList.add('active');

        sections.forEach(sec => sec.style.display = 'none');

        const sectionId = link.getAttribute('data-section');
        const sectionEl = document.getElementById(sectionId);
        if (sectionEl) {
          sectionEl.style.display = 'block';
        }
      });
    });
  }

  function initGeneralSettingsActions() {
    const generalSettingsForm = document.getElementById('generalSettingsForm');
    if (!generalSettingsForm) return;

    const cancelBtn = generalSettingsForm.closest('.settings-panel')?.querySelector('.btn-secondary');
    const saveBtn = generalSettingsForm.closest('.settings-panel')?.querySelector('.btn-primary');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loadGeneralSettings();
        showNotification('Changes canceled', 'info');
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        saveGeneralSettings();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSettingsTabs();
    initGeneralSettingsActions();
    loadGeneralSettings();
    loadAdminProfile();
    loadUsers();
    loadRoles();
    loadSystemStatus();
    loadNotifications();
  });

})();