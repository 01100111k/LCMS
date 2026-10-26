import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface HealthArticle {
  id: string;
  title: string;
  category: 'Prenatal Care' | 'Labor & Delivery' | 'Postpartum' | 'Newborn Care' | 'Nutrition' | 'Emergency Protocols';
  readingTime: string;
  audience: 'Clinical Midwife' | 'Patient Education' | 'All Staff';
  summary: string;
  keyPoints: string[];
  fullContent: {
    overview: string;
    clinicalSteps?: string[];
    patientCounseling?: string[];
    dohReferences?: string;
  };
  icon: string;
  tagColor: string;
}

@Component({
  selector: 'app-health-library',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="library-page-wrap">
      <!-- ============ TOP HEADER BANNER ============ -->
      <div class="library-header-card">
        <div class="header-left">
          <div class="header-icon-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <div>
            <h1>Maternal & Newborn Clinical Health Library</h1>
            <p class="header-sub">Evidence-based clinical guidelines, DOH obstetrical protocols, emergency management, and patient education guides.</p>
          </div>
        </div>

        <div class="header-stats-group">
          <div class="stat-bubble">
            <strong>{{ articles.length }}</strong>
            <span>Clinical Guides</span>
          </div>
          <div class="stat-bubble">
            <strong>6</strong>
            <span>Care Categories</span>
          </div>
        </div>
      </div>

      <!-- ============ SEARCH & CATEGORY FILTER TABS ============ -->
      <div class="controls-card">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Search guidelines, protocols, danger signs, breastfeeding, or newborn care..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
        </div>

        <div class="category-tabs-row">
          @for (cat of categories; track cat) {
            <button
              type="button"
              class="cat-tab-btn"
              [class.active]="selectedCategory() === cat"
              (click)="selectedCategory.set(cat)"
            >
              {{ cat }}
            </button>
          }
        </div>
      </div>

      <!-- ============ QUICK-ACCESS EMERGENCY & PROTOCOL CARDS ============ -->
      <div class="protocols-banner-grid">
        <div class="proto-card proto-einc" (click)="openQuickProto('einc')">
          <div class="proto-head">
            <span class="proto-tag">DOH Clinical Protocol</span>
            <span class="proto-icon">👶</span>
          </div>
          <h3>Essential Intrapartum & Newborn Care (EINC)</h3>
          <p>The 4 core time-bound steps proven to reduce neonatal mortality and hypothermia.</p>
          <span class="btn-read-proto">View 4-Step Standard →</span>
        </div>

        <div class="proto-card proto-pph" (click)="openQuickProto('pph')">
          <div class="proto-head">
            <span class="proto-tag emergency-tag">Emergency Action</span>
            <span class="proto-icon">🚨</span>
          </div>
          <h3>Postpartum Hemorrhage (PPH) Management</h3>
          <p>Immediate uterotonic administration, uterine massage, bimanual compression & referral flow.</p>
          <span class="btn-read-proto emergency-text">Emergency Protocol →</span>
        </div>

        <div class="proto-card proto-danger" (click)="openQuickProto('danger')">
          <div class="proto-head">
            <span class="proto-tag warning-tag">Red Flag Guide</span>
            <span class="proto-icon">⚠️</span>
          </div>
          <h3>Maternal Danger Signs & Preeclampsia</h3>
          <p>Critical signs requiring immediate lying-in triage or hospital emergency transport.</p>
          <span class="btn-read-proto warning-text">Screening Criteria →</span>
        </div>
      </div>

      <!-- ============ ARTICLES GRID ============ -->
      <div class="articles-grid">
        @for (art of filteredArticles(); track art.id) {
          <div class="article-card" (click)="viewArticle(art)">
            <div class="article-top-row">
              <span class="cat-pill" [ngClass]="'tone-' + art.tagColor">{{ art.category }}</span>
              <span class="reading-time">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {{ art.readingTime }}
              </span>
            </div>

            <h3 class="article-title">{{ art.title }}</h3>
            <p class="article-summary">{{ art.summary }}</p>

            <div class="article-keypoints">
              @for (kp of art.keyPoints.slice(0, 3); track kp) {
                <div class="kp-item">
                  <span class="kp-dot">•</span>
                  <span>{{ kp }}</span>
                </div>
              }
            </div>

            <div class="article-footer">
              <span class="audience-badge">{{ art.audience }}</span>
              <button type="button" class="btn-read-article">
                Read Guide
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        }
      </div>

      @if (filteredArticles().length === 0) {
        <div class="no-results-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          <h3>No guidelines found for "{{ searchQuery() }}"</h3>
          <p>Try searching for other clinical terms like "EINC", "blood pressure", "lochia", or select "All Topics".</p>
          <button type="button" class="btn-reset-filters" (click)="resetFilters()">Clear Filters</button>
        </div>
      }

      <!-- ============ DETAIL ARTICLE MODAL ============ -->
      @if (selectedArticle(); as art) {
        <div class="modal-backdrop" (click)="closeArticleModal()">
          <div class="modal-dialog-card modal-lg" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-row">
                <div class="modal-icon tone-purple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                </div>
                <div>
                  <span class="modal-cat-tag">{{ art.category }} · {{ art.audience }}</span>
                  <h2>{{ art.title }}</h2>
                </div>
              </div>
              <button type="button" class="btn-close-modal" (click)="closeArticleModal()" title="Close dialog">✕</button>
            </div>

            <div class="article-modal-body">
              <div class="article-callout-box">
                <strong>Clinical Summary:</strong>
                <p>{{ art.summary }}</p>
              </div>

              <div class="article-section">
                <h3>Clinical Overview & Protocol Standards</h3>
                <p class="article-body-p">{{ art.fullContent.overview }}</p>
              </div>

              @if (art.fullContent.clinicalSteps && art.fullContent.clinicalSteps.length > 0) {
                <div class="article-section">
                  <h3>Clinical Execution Steps</h3>
                  <div class="steps-flow-list">
                    @for (st of art.fullContent.clinicalSteps; track st; let idx = $index) {
                      <div class="step-flow-item">
                        <div class="flow-num">{{ idx + 1 }}</div>
                        <div class="flow-text">{{ st }}</div>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (art.fullContent.patientCounseling && art.fullContent.patientCounseling.length > 0) {
                <div class="article-section">
                  <h3>Patient Counseling & Midwife Advice</h3>
                  <ul class="counseling-list">
                    @for (c of art.fullContent.patientCounseling; track c) {
                      <li>{{ c }}</li>
                    }
                  </ul>
                </div>
              }

              @if (art.fullContent.dohReferences) {
                <div class="reference-box">
                  <span class="ref-title">Regulatory & Clinical Standard Reference:</span>
                  <p>{{ art.fullContent.dohReferences }}</p>
                </div>
              }
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-cancel" (click)="closeArticleModal()">Close</button>
              <button type="button" class="btn-print" (click)="printArticle()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print Guideline Handout
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .library-page-wrap {
      max-width: 1240px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* Top Header Card */
    .library-header-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      box-shadow: 0 2px 10px rgba(54, 23, 89, 0.03);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon-pill {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      background: #361759;
      color: #ffffff;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(54, 23, 89, 0.25);
    }

    .header-icon-pill svg {
      width: 22px;
      height: 22px;
    }

    .library-header-card h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      color: #271442;
      letter-spacing: -0.01em;
    }

    .header-sub {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: #7a7189;
      max-width: 720px;
      line-height: 1.45;
    }

    .header-stats-group {
      display: flex;
      gap: 12px;
      flex-shrink: 0;
    }

    .stat-bubble {
      background: #fbf9fd;
      border: 1px solid #ebdff5;
      border-radius: 10px;
      padding: 8px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .stat-bubble strong {
      font-size: 18px;
      color: #361759;
      font-weight: 800;
    }

    .stat-bubble span {
      font-size: 10.5px;
      color: #7a7189;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.04em;
    }

    /* Controls card */
    .controls-card {
      background: #ffffff;
      border: 1px solid #ebe5f5;
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.02);
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fbf9fd;
      border: 1.5px solid #d4c8e8;
      border-radius: 10px;
      padding: 9px 14px;
      transition: all 0.15s ease;
    }

    .search-box:focus-within {
      background: #ffffff;
      border-color: #361759;
      box-shadow: 0 0 0 3px rgba(54, 23, 89, 0.08);
    }

    .search-box svg {
      width: 17px;
      height: 17px;
      color: #7a7189;
      flex-shrink: 0;
    }

    .search-box input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 13.5px;
      color: #271442;
      width: 100%;
    }

    .category-tabs-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .cat-tab-btn {
      padding: 6.5px 14px;
      border: 1px solid #e7ddf2;
      background: #fbf9fd;
      color: #554869;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .cat-tab-btn:hover {
      background: #f0eaf8;
      color: #271442;
    }

    .cat-tab-btn.active {
      background: #361759;
      color: #ffffff;
      border-color: #361759;
      box-shadow: 0 3px 8px rgba(54, 23, 89, 0.22);
    }

    /* Emergency & Protocol Banner Grid */
    .protocols-banner-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }

    .proto-card {
      border-radius: 14px;
      padding: 18px 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .proto-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(54, 23, 89, 0.08);
    }

    .proto-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .proto-tag {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 8px;
      border-radius: 999px;
      background: #e6f7f3;
      color: #0b6b58;
    }

    .emergency-tag { background: #fee2e2; color: #991b1b; }
    .warning-tag { background: #fef3c7; color: #92400e; }

    .proto-icon { font-size: 20px; }

    .proto-card h3 {
      margin: 0 0 4px;
      font-size: 15px;
      font-weight: 800;
      color: #271442;
    }

    .proto-card p {
      margin: 0 0 12px;
      font-size: 12px;
      color: #554869;
      line-height: 1.45;
    }

    .btn-read-proto {
      font-size: 12px;
      font-weight: 700;
      color: #361759;
    }

    .emergency-text { color: #b91c1c !important; }
    .warning-text { color: #b45309 !important; }

    .proto-einc { background: #fbf9fe; border: 1.5px solid #ded4ea; }
    .proto-pph { background: #fff5f5; border: 1.5px solid #fecdd3; }
    .proto-danger { background: #fffbeb; border: 1.5px solid #fde68a; }

    /* Articles Grid */
    .articles-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .article-card {
      background: #ffffff;
      border: 1px solid #ebdff5;
      border-radius: 14px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 2px 8px rgba(54, 23, 89, 0.02);
    }

    .article-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 22px rgba(54, 23, 89, 0.07);
      border-color: #d4c4e8;
    }

    .article-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .cat-pill {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 3px 8px;
      border-radius: 6px;
    }

    .cat-pill.tone-purple { background: #f3effa; color: #361759; }
    .cat-pill.tone-teal { background: #e6f7f3; color: #0b6b58; }
    .cat-pill.tone-pink { background: #fdf2f8; color: #be185d; }
    .cat-pill.tone-blue { background: #e0f2fe; color: #0369a1; }
    .cat-pill.tone-red { background: #fee2e2; color: #991b1b; }
    .cat-pill.tone-amber { background: #fef3c7; color: #92400e; }

    .reading-time {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: #8c829e;
      font-weight: 600;
    }

    .reading-time svg { width: 12px; height: 12px; }

    .article-title {
      margin: 4px 0 6px;
      font-size: 15px;
      font-weight: 800;
      color: #271442;
      line-height: 1.35;
    }

    .article-summary {
      margin: 0 0 12px;
      font-size: 12px;
      color: #695f77;
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .article-keypoints {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 16px;
      flex: 1;
    }

    .kp-item {
      font-size: 11.5px;
      color: #4a3a60;
      display: flex;
      align-items: flex-start;
      gap: 6px;
      line-height: 1.35;
    }

    .kp-dot { color: #a497b9; font-weight: bold; }

    .article-footer {
      border-top: 1px solid #f0eaf8;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .audience-badge {
      font-size: 10.5px;
      color: #7a7189;
      font-weight: 600;
    }

    .btn-read-article {
      border: none;
      background: transparent;
      color: #361759;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0;
      transition: gap 0.15s ease;
    }

    .btn-read-article:hover {
      gap: 7px;
    }

    .btn-read-article svg { width: 13px; height: 13px; }

    /* No results card */
    .no-results-card {
      background: #ffffff;
      border: 1px dashed #d8cde9;
      border-radius: 14px;
      padding: 48px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .no-results-card svg { width: 36px; height: 36px; color: #a497b9; }
    .no-results-card h3 { margin: 0; font-size: 16px; color: #271442; }
    .no-results-card p { margin: 0; font-size: 12.5px; color: #7a7189; max-width: 420px; }

    .btn-reset-filters {
      margin-top: 8px;
      padding: 8px 18px;
      background: #361759;
      color: #ffffff;
      border: none;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
    }

    /* Modal Backdrop & Article Detail Dialog */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(30, 10, 50, 0.55);
      backdrop-filter: blur(4px);
      display: grid;
      place-items: center;
      z-index: 1000;
      padding: 16px;
    }

    .modal-dialog-card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(35, 12, 60, 0.35);
      border: 1px solid rgba(110, 79, 168, 0.15);
      width: 100%;
      max-width: 820px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .modal-header {
      padding: 18px 24px;
      border-bottom: 1px solid #ebe5f5;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #faf8fd;
    }

    .modal-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-icon {
      width: 42px;
      height: 42px;
      border-radius: 11px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .modal-icon.tone-purple { background: #f3effa; color: #361759; }
    .modal-icon svg { width: 22px; height: 22px; }

    .modal-cat-tag {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6b4fa3;
      letter-spacing: 0.05em;
    }

    .modal-title-row h2 {
      margin: 2px 0 0;
      font-size: 17px;
      font-weight: 800;
      color: #271442;
    }

    .btn-close-modal {
      background: none;
      border: none;
      font-size: 18px;
      color: #7a7189;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 8px;
    }

    .btn-close-modal:hover { background: #ede7f6; color: #271442; }

    .article-modal-body {
      padding: 22px 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .article-callout-box {
      background: #fcfaff;
      border: 1.5px solid #ebdff5;
      border-radius: 12px;
      padding: 14px 16px;
    }

    .article-callout-box strong {
      font-size: 12.5px;
      color: #361759;
      display: block;
      margin-bottom: 4px;
    }

    .article-callout-box p {
      margin: 0;
      font-size: 13px;
      color: #4a3a60;
      line-height: 1.45;
    }

    .article-section h3 {
      margin: 0 0 10px;
      font-size: 14px;
      font-weight: 800;
      color: #271442;
      border-bottom: 1px solid #ebe5f5;
      padding-bottom: 4px;
    }

    .article-body-p {
      margin: 0;
      font-size: 13px;
      color: #4a3a60;
      line-height: 1.55;
    }

    .steps-flow-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .step-flow-item {
      display: flex;
      gap: 12px;
      background: #faf8fd;
      border: 1px solid #ece4f5;
      border-radius: 10px;
      padding: 10px 14px;
      align-items: flex-start;
    }

    .flow-num {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #361759;
      color: #ffffff;
      font-size: 11.5px;
      font-weight: 800;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .flow-text {
      font-size: 12.5px;
      color: #271442;
      line-height: 1.45;
    }

    .counseling-list {
      margin: 0;
      padding-left: 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      color: #4a3a60;
      line-height: 1.5;
    }

    .reference-box {
      background: #f4effb;
      border-radius: 10px;
      padding: 12px 14px;
      border-left: 4px solid #361759;
    }

    .ref-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #361759;
      display: block;
      margin-bottom: 3px;
    }

    .reference-box p {
      margin: 0;
      font-size: 12px;
      color: #554869;
    }

    .modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 24px;
      border-top: 1px solid #ebe5f5;
      background: #fbf9fd;
    }

    .btn-cancel {
      padding: 9px 18px;
      background: #f4effb;
      color: #361759;
      border: none;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 20px;
      background: #361759;
      color: #ffffff;
      border: none;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(54, 23, 89, 0.22);
    }

    .btn-print svg { width: 15px; height: 15px; }

    @media (max-width: 900px) {
      .protocols-banner-grid, .articles-grid {
        grid-template-columns: 1fr;
      }
      .library-header-card {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `,
})
export class HealthLibrary {
  readonly searchQuery = signal('');
  readonly selectedCategory = signal('All Topics');
  readonly selectedArticle = signal<HealthArticle | null>(null);

  readonly categories = [
    'All Topics',
    'Prenatal Care',
    'Labor & Delivery',
    'Postpartum',
    'Newborn Care',
    'Nutrition',
    'Emergency Protocols',
  ];

  readonly articles: HealthArticle[] = [
    {
      id: 'einc-protocol',
      title: 'Essential Intrapartum and Newborn Care (EINC)',
      category: 'Labor & Delivery',
      readingTime: '5 min read',
      audience: 'Clinical Midwife',
      icon: '👶',
      tagColor: 'teal',
      summary: 'Evidence-based DOH standards for the first 90 minutes of life proven to lower neonatal mortality and hypothermia.',
      keyPoints: [
        'Immediate drying for 30 seconds',
        'Early uninterrupted skin-to-skin contact for ≥90 minutes',
        'Delayed cord clamping until pulsations stop (1-3 min)',
        'Early initiation of breastfeeding through newborn feeding cues',
      ],
      fullContent: {
        overview:
          'Essential Intrapartum and Newborn Care (EINC) represents the international gold standard protocol for birthing facilities. By following the precise time-bound sequence, healthcare providers prevent neonatal hypothermia, reduce maternal hemorrhage risk, establish healthy microflora colonization, and maximize exclusive breastfeeding success.',
        clinicalSteps: [
          'Immediate and thorough drying of the newborn using a clean, dry, warm cloth for 30 seconds. Do not wipe off vernix caseosa as it serves as a protective antimicrobial barrier.',
          'Early skin-to-skin contact: place baby prone directly on mother’s bare chest. Cover newborn back with a warm dry blanket and bonnet to maintain thermal comfort.',
          'Properly timed cord clamping: clamp and cut the umbilical cord only after pulsations cease (typically 1 to 3 minutes post-delivery). Avoid milking the cord toward the infant.',
          'Non-separation and early breastfeeding: wait for infant feeding cues (rooting, mouth movements, crawling). Do not force latching; support mother and infant in uninterrupted bonding.',
        ],
        patientCounseling: [
          'Advise mother on the importance of keeping baby warm against her chest rather than immediate bathing.',
          'Explain that bathing is delayed for at least 6 to 24 hours to prevent hypothermia.',
        ],
        dohReferences: 'DOH Administrative Order No. 2009-0025: Adopting New Policies and Guidelines on Essential Newborn Care.',
      },
    },
    {
      id: 'pph-management',
      title: 'Postpartum Hemorrhage (PPH) Emergency Protocol',
      category: 'Emergency Protocols',
      readingTime: '6 min read',
      audience: 'All Staff',
      icon: '🚨',
      tagColor: 'red',
      summary: 'Step-by-step clinical triage and immediate interventions for maternal blood loss exceeding 500 mL following vaginal birth.',
      keyPoints: [
        'Call for immediate emergency assistance and staff backup',
        'Uterotonic administration: Oxytocin 10 IU IM or IV infusion',
        'Bimanual uterine compression and continuous fundal massage',
        'Immediate preparation of two large-bore IV lines and hospital transfer',
      ],
      fullContent: {
        overview:
          'Postpartum hemorrhage is the leading cause of preventable maternal mortality. Uterine atony accounts for over 70% of PPH cases. Swift recognition, systematic clinical execution of the 4Ts (Tone, Trauma, Tissue, Thrombin), and early decision to transfer are vital in lying-in clinic settings.',
        clinicalSteps: [
          'Shout for help! Notify backup midwife, prepare emergency delivery kit, and call referral tertiary hospital.',
          'Assess Uterine Tone: Perform vigorous external uterine massage. Administer Oxytocin 10 IU IM or 20 IU in 1L Normal Saline at 60 drops/min.',
          'Inspect for Trauma: Check perineum, vagina, and cervix for tears. Apply direct pressure or repair bleeding lacerations.',
          'Check for Retained Tissue: Examine expelled placenta for missing cotyledons or ragged membranes.',
          'If bleeding persists: perform internal bimanual uterine compression. Insert Foley catheter to empty bladder and monitor output.',
          'Initiate urgent hospital referral transfer with IV fluids running and trained midwife accompanying the mother.',
        ],
        patientCounseling: [
          'Keep companion informed of emergency transfer steps and ensure donor blood readiness at referral hospital.',
        ],
        dohReferences: 'DOH Clinical Practice Guidelines on Maternal and Postpartum Hemorrhage Management; WHO Recommendations for the Prevention and Treatment of Postpartum Hemorrhage.',
      },
    },
    {
      id: 'preeclampsia-screening',
      title: 'Preeclampsia & Hypertensive Disorders in Pregnancy',
      category: 'Emergency Protocols',
      readingTime: '5 min read',
      audience: 'Clinical Midwife',
      icon: '⚠️',
      tagColor: 'amber',
      summary: 'Screening criteria, BP monitoring thresholds, danger sign recognition, and magnesium sulfate emergency referral protocols.',
      keyPoints: [
        'BP ≥140/90 mmHg on two occasions at least 4 hours apart after 20 weeks',
        'Urinalysis testing for proteinuria (≥1+ dipstick or 300mg/24h)',
        'Red flag signs: severe headache, visual disturbances, epigastric pain',
        'Emergency loading dose of Magnesium Sulfate for impending eclampsia',
      ],
      fullContent: {
        overview:
          'Hypertensive disorders of pregnancy encompass gestational hypertension, preeclampsia, and eclampsia. Early detection during routine prenatal visits prevents progression to seizures, placental abruption, and maternal end-organ damage.',
        clinicalSteps: [
          'Routine BP Measurement: Use appropriate cuff size with patient seated, arm supported at heart level after 5 minutes of rest.',
          'Proteinuria Assessment: Perform urinalysis dipstick at every visit. A reading of +1 or greater warrants close clinical monitoring.',
          'Assess for Severe Features: BP ≥160/110 mmHg, persistent occipital/frontal headache, scotoma/blurred vision, right upper quadrant pain, pulmonary edema.',
          'For Preeclampsia with Severe Features in Lying-In: Administer Magnesium Sulfate loading dose (4g IV over 15-20 min + 10g IM: 5g in each buttock) prior to urgent ambulance transfer.',
        ],
        patientCounseling: [
          'Instruct mother and family to immediately report severe throbbing headaches, dizziness, or seeing spots.',
          'Emphasize daily kick counts and low-sodium, high-protein balanced diet.',
        ],
        dohReferences: 'Philippine Obstetrical and Gynecological Society (POGS) Clinical Guidelines on Hypertension in Pregnancy.',
      },
    },
    {
      id: 'who-prenatal-care',
      title: 'WHO & DOH 8-Contact Antenatal Care Model',
      category: 'Prenatal Care',
      readingTime: '4 min read',
      audience: 'Clinical Midwife',
      icon: '📋',
      tagColor: 'purple',
      summary: 'Recommended visit schedule and minimum clinical package for comprehensive maternal monitoring throughout gestation.',
      keyPoints: [
        'Contact 1: Up to 12 weeks (Baseline dating, CBC, ABO/Rh, Urinalysis)',
        'Contacts 2 & 3: 20 and 26 weeks (Anomaly scan, TT immunization, OGTT)',
        'Contacts 4 to 8: 30, 34, 36, 38, and 40 weeks (Fetal lie, growth, birth preparedness)',
      ],
      fullContent: {
        overview:
          'The 8-contact model replaces the former 4-visit model to enhance quality of care and reduce perinatal mortality. Regular visits facilitate early detection of obstetric complications, nutritional support, and continuous maternal counseling.',
        clinicalSteps: [
          'Contact 1 (<12w): Medical history, baseline vitals, obstetric score, dating ultrasound, routine blood typing, and folic acid start.',
          'Contact 2 (20w): Auscultate FHR with fetal Doppler, measure fundal height, review Congenital Anomaly Scan (CAS), administer TT1.',
          'Contact 3 (26w): Oral Glucose Tolerance Test (OGTT), screening for gestational diabetes, administer TT2.',
          'Contacts 4-8 (30, 34, 36, 38, 40w): Monitor maternal weight gain, evaluate fetal presentation by Leopold maneuvers, review PhilHealth birthing kit checklist.',
        ],
        patientCounseling: [
          'Reassure mother that frequent checkups in the 3rd trimester ensure safe labor planning at the birthing center.',
        ],
        dohReferences: 'WHO Recommendations on Antenatal Care for a Positive Pregnancy Experience; DOH AO 2016-0035.',
      },
    },
    {
      id: 'exclusive-breastfeeding',
      title: 'Exclusive Breastfeeding & Latch Counseling',
      category: 'Nutrition',
      readingTime: '4 min read',
      audience: 'Patient Education',
      icon: '🤱',
      tagColor: 'pink',
      summary: 'Clinical guidance on latch alignment, milk supply stimulation, management of engorgement, and 6-month exclusive feeding.',
      keyPoints: [
        'Exclusive breastfeeding for the first 6 months of life without water or formula',
        'Proper latch signs: wide open mouth, flanged lips, chin touching breast',
        'Colostrum benefits: rich in antibodies, acts as natural newborn laxative',
        'Managing engorgement: warm compress before feeds, cold compress after',
      ],
      fullContent: {
        overview:
          'Breast milk is the complete, species-specific nutritional source for infants. Early exclusive breastfeeding prevents neonatal infections, promotes optimal cognitive development, and stimulates oxytocin release aiding uterine involution.',
        clinicalSteps: [
          'Positioning Check: Mom comfortable, baby chest-to-chest, nose opposite nipple.',
          'Latch Assessment: Wait for wide yawn; bring baby to breast (not breast to baby). Most of the lower areola should be in baby’s mouth.',
          'Feeding Frequency: Feed on demand (8 to 12 times in 24 hours). Allow baby to finish first breast completely to receive calorie-dense hindmilk.',
          'Engorgement Care: Hand expression or gentle massage to soften areola before latching; apply cool cabbage leaves or cold packs between feeds.',
        ],
        patientCounseling: [
          'Assure mother that colostrum (golden milk) in the first 2-3 days is sufficient in volume for a newborn’s marble-sized stomach.',
          'Warn against introducing pacifiers or artificial nipples during the first 4 weeks to avoid nipple confusion.',
        ],
        dohReferences: 'Republic Act No. 10028: Expanded Breastfeeding Promotion Act of 2009.',
      },
    },
    {
      id: 'postpartum-involution',
      title: 'Normal Uterine Involution & Lochia Assessment',
      category: 'Postpartum',
      readingTime: '4 min read',
      audience: 'Clinical Midwife',
      icon: '🩺',
      tagColor: 'teal',
      summary: 'Evaluation of fundal descent, lochia progression (Rubra, Serosa, Alba), and early detection of subinvolution or endometritis.',
      keyPoints: [
        'Uterus descends ~1 cm (1 fingerbreadth) each day postpartum',
        'Lochia Rubra (Days 1-4) → Lochia Serosa (Days 4-10) → Lochia Alba (Days 10-28)',
        'REEDA episiotomy scale: Redness, Edema, Ecchymosis, Discharge, Approximation',
        'Subinvolution causes: retained placental fragments or pelvic infection',
      ],
      fullContent: {
        overview:
          'Uterine involution is the process whereby the postpartum uterus returns to its pre-pregnant state. Daily assessment of fundal height, firmness, and lochia character ensures early detection of secondary postpartum hemorrhage or puerperal sepsis.',
        clinicalSteps: [
          'Ask mother to void prior to assessment; a full bladder displaces the uterus upward and to the right.',
          'Palpate fundus with one hand while supporting lower uterine segment above symphysis pubis.',
          'Immediate postpartum: fundus is firm, midway between umbilicus and symphysis pubis.',
          'By Day 1: at umbilicus level; subsequently descends 1 fingerbreadth per 24 hours. By Day 10, no longer palpable abdominally.',
          'Lochia Evaluation: Inspect pad for color, volume, and odor. A foul odor or soaking a pad within 1 hour requires immediate medical workup.',
        ],
        patientCounseling: [
          'Advise mother on frequent perineal wash with warm water from front to back after voiding.',
          'Encourage early ambulation and adequate resting periods.',
        ],
        dohReferences: 'Midwifery Clinical Practice Manual: Postpartum Care Guidelines.',
      },
    },
    {
      id: 'newborn-screening',
      title: 'Expanded Newborn Screening & Birth Immunization',
      category: 'Newborn Care',
      readingTime: '5 min read',
      audience: 'Clinical Midwife',
      icon: '💉',
      tagColor: 'blue',
      summary: 'Standard timeline and collection protocol for Expanded Newborn Screening (ENBS), Vitamin K, Hep B birth dose, and BCG.',
      keyPoints: [
        'Vitamin K1 (Phytonadione 1 mg IM) within 1-2 hours of birth to prevent VKDB',
        'Hepatitis B birth dose (0.5 mL IM) within 24 hours',
        'BCG vaccine (0.05 mL ID) given at birth or prior to discharge',
        'Expanded Newborn Screening heel-prick collection ideally between 24 and 72 hours of life',
      ],
      fullContent: {
        overview:
          'The Expanded Newborn Screening (ENBS) program in the Philippines screens for 29 congenital metabolic, endocrine, and hematologic disorders. Early detection and treatment prevent irreversible mental retardation or neonatal death.',
        clinicalSteps: [
          'Administer Vitamin K1 1mg (0.1 mL) IM at anterolateral thigh (vastus lateralis) within 2 hours of life.',
          'Apply 0.5% Erythromycin ophthalmic ointment to both newborn eyes for ophthalmia neonatorum prophylaxis.',
          'Administer Hepatitis B vaccine 0.5 mL IM in the opposite vastus lateralis within 24 hours of birth.',
          'Perform ENBS heel-prick blood collection on special filter paper after 24 hours of feeding. Warm heel for 3 minutes, prick lateral plantar surface, fill all circles uniformly.',
          'Administer BCG 0.05 mL intradermally over the right deltoid muscle.',
        ],
        patientCounseling: [
          'Inform parents of the importance of claiming ENBS test results and returning for the 1-week follow-up visit.',
          'Explain that a small red papule will form at the BCG site after 2 to 4 weeks, which is completely normal.',
        ],
        dohReferences: 'Republic Act No. 9288: Newborn Screening Act of 2004; DOH AO 2014-0045.',
      },
    },
    {
      id: 'maternal-nutrition',
      title: 'Maternal Nutrition & Micronutrient Supplementation',
      category: 'Nutrition',
      readingTime: '4 min read',
      audience: 'Patient Education',
      icon: '🥗',
      tagColor: 'teal',
      summary: 'Essential dietary requirements, caloric needs during pregnancy and lactation, and DOH micronutrient supplementation schedules.',
      keyPoints: [
        'Elemental Iron 60 mg + Folic Acid 400 mcg daily throughout pregnancy',
        'Calcium Carbonate 1,000 - 1,500 mg daily from 20 weeks onward',
        'Diet rich in dark leafy vegetables, eggs, legumes, and lean protein',
        'Avoid raw/undercooked meats, unpasteurized milk, and excess caffeine',
      ],
      fullContent: {
        overview:
          'Adequate maternal nutrition directly influences fetal birth weight, gestational length, and maternal recovery. Iron deficiency anemia increases the risk of preterm labor and severe maternal complications during birth.',
        clinicalSteps: [
          'Prescribe Ferrous Sulfate (300mg tablet containing 60mg elemental iron) + Folic Acid daily. Advise taking with citrus juice (Vitamin C) for enhanced absorption.',
          'Prescribe Calcium Carbonate from Week 20 to reduce preeclampsia risk and support fetal skeletal development.',
          'Do not take Iron and Calcium tablets simultaneously; space them at least 2 hours apart.',
          'Monitor maternal weight gain: recommended 25-35 lbs (11.5 - 16 kg) for normal BMI mothers.',
        ],
        patientCounseling: [
          'Advise that iron supplements may cause harmless dark stools and mild constipation; recommend extra water and dietary fiber.',
          'Encourage clean eating, staying hydrated with 8-10 glasses of water daily, and iodized salt.',
        ],
        dohReferences: 'National Nutrition Council (NNC) Guidelines on Maternal and Young Child Nutrition.',
      },
    },
    {
      id: 'philhealth-mcp',
      title: 'PhilHealth Maternity Care Package (MCP) & NCP Guidelines',
      category: 'Labor & Delivery',
      readingTime: '5 min read',
      audience: 'All Staff',
      icon: '🏥',
      tagColor: 'purple',
      summary: 'Accreditation standards, claim requirements (Claim Form 2, MDC), and covered clinical inclusions for lying-in facilities.',
      keyPoints: [
        'MCP Benefit covers antenatal care, normal delivery, postpartum care, and family planning counseling',
        'NCP Benefit covers newborn physical exam, Vitamin K, eye ointment, BCG, Hep B, and Expanded Newborn Screening',
        'Essential claim attachments: Partograph, prenatal flow sheet, newborn recording form',
        'No Balance Billing (NBB) compliance for indigent and sponsored maternal beneficiaries',
      ],
      fullContent: {
        overview:
          'The PhilHealth Maternity Care Package (MCP) is designed to encourage facility-based deliveries and eliminate maternal and neonatal mortality by subsidizing quality, accredited lying-in birthing center care. Adherence to complete documentation ensures seamless reimbursement and zero out-of-pocket costs for qualified mothers under the No Balance Billing policy.',
        clinicalSteps: [
          'Verify PhilHealth Member Data Record (MDR) and PIN upon first prenatal contact or admission.',
          'Complete standard DOH clinical partograph for every active stage of labor.',
          'Administer essential intrapartum and newborn care services strictly adhering to accredited guidelines.',
          'Fill out PhilHealth Claim Form 2 (CF2), Member Consent Form, and maternal discharge diagnosis (ICD-10 O80).',
          'Execute Newborn Care Package (NCP): attach ENBS filter paper tracking number and immunization log.',
        ],
        patientCounseling: [
          'Guide pregnant members on updating their PhilHealth dependent records prior to their expected due date.',
          'Inform mothers that accredited lying-in delivery includes essential newborn vaccines and screening without additional fees under NBB.',
        ],
        dohReferences: 'PhilHealth Circular No. 022-2014 & Circular No. 2018-0019: Provider Payment Guidelines for the Maternity Care Package.',
      },
    },
    {
      id: 'prom-management',
      title: 'Premature Rupture of Membranes (PROM) Clinical Triage',
      category: 'Emergency Protocols',
      readingTime: '5 min read',
      audience: 'Clinical Midwife',
      icon: '💧',
      tagColor: 'amber',
      summary: 'Sterile assessment, nitrazine test verification, infection monitoring (chorioamnionitis), and emergency referral criteria.',
      keyPoints: [
        'Confirmation of amniotic fluid leak: sterile speculum exam (avoid digital vaginal exams)',
        'Nitrazine paper test: pH turns deep blue/green (>6.5 - 7.5)',
        'Chorioamnionitis red flags: maternal fever (≥38°C), foul discharge, fetal tachycardia (>160 bpm)',
        'Prompt referral to tertiary facility if gestation is preterm (<37 weeks) or latent period >18 hours',
      ],
      fullContent: {
        overview:
          'Premature Rupture of Membranes (PROM) refers to membrane rupture prior to the onset of labor contractions. It poses significant risks of maternal-fetal infection, cord prolapse, and placental abruption. In low-risk birthing clinics, immediate clinical differentiation between term PROM and preterm PROM determines safe management versus urgent referral.',
        clinicalSteps: [
          'Confirm Leakage: Inspect perineal pad. Perform sterile speculum examination to visualize amniotic pooling in the posterior vaginal fornix.',
          'Avoid Unnecessary Digital Vaginal Examinations (DVE): Routine digital checks increase bacterial inoculation into the uterine cavity.',
          'Nitrazine & Ferning Tests: Amniotic fluid is alkaline (pH 7.0–7.5), turning yellow Nitrazine paper blue.',
          'Check for Chorioamnionitis: Assess maternal temperature, pulse, fetal heart rate, and uterine tenderness.',
          'Term PROM (>37 weeks) without infection: If contractions do not start within 12-18 hours, initiate referral for labor induction.',
          'Preterm PROM (<37 weeks): Administer broad-spectrum prophylactic antibiotics per protocol and immediately transfer to tertiary hospital.',
        ],
        patientCounseling: [
          'Instruct mother not to insert any tampons or douche, and to record the exact time the amniotic fluid first gushed or trickled.',
          'Advise immediate presentation to the facility if the fluid appears green (meconium) or has an offensive odor.',
        ],
        dohReferences: 'WHO Guidelines on Prevention and Management of Infections in Pregnancy and Childbirth.',
      },
    },
    {
      id: 'gdm-management',
      title: 'Gestational Diabetes Mellitus (GDM) Screening & Care',
      category: 'Prenatal Care',
      readingTime: '5 min read',
      audience: 'Clinical Midwife',
      icon: '🩸',
      tagColor: 'purple',
      summary: '75g 2-hour Oral Glucose Tolerance Test (OGTT) thresholds, dietary management, macrosomia prevention, and postpartum testing.',
      keyPoints: [
        'Routine screening between 24 and 28 weeks of gestation for all pregnant women',
        'Diagnosis made if any single 75g OGTT threshold is met: Fasting ≥92, 1-hr ≥180, 2-hr ≥153 mg/dL',
        'Maternal diet: complex carbohydrates, high fiber, elimination of refined sugars',
        'Postpartum follow-up: repeat 75g OGTT at 6 to 12 weeks to rule out persistent Type 2 Diabetes',
      ],
      fullContent: {
        overview:
          'Gestational Diabetes Mellitus (GDM) is carbohydrate intolerance first recognized during pregnancy due to placental anti-insulin hormones. Uncontrolled GDM significantly increases risks of fetal macrosomia (>4,000g), shoulder dystocia, preeclampsia, and neonatal hypoglycemia.',
        clinicalSteps: [
          'Schedule universal 75g 2-hour OGTT at 24 to 28 weeks gestation. Mother must fast for 8 to 10 hours prior to venous blood draw.',
          'Interpret Results (IADPSG/WHO criteria): Fasting plasma glucose ≥92 mg/dL (5.1 mmol/L), 1-hour ≥180 mg/dL (10.0 mmol/L), or 2-hour ≥153 mg/dL (8.5 mmol/L). One abnormal value confirms GDM.',
          'Medical Nutrition Therapy (MNT): First-line management. Distribute caloric intake across 3 balanced meals and 2-3 protein-rich snacks.',
          'Fetal Surveillance: Monitor fundal height carefully. If fundal height exceeds gestational age by >3 cm, refer for biometry ultrasound to evaluate for macrosomia or polyhydramnios.',
        ],
        patientCounseling: [
          'Encourage 30 minutes of low-impact physical activity (e.g. brisk walking) daily after meals.',
          'Educate on replacing white rice and sugary drinks with brown rice, whole oats, and fresh leafy vegetables.',
        ],
        dohReferences: 'Philippine Association of Diabetes Educators (PADE) & UNP Clinical Guidelines for Gestational Diabetes.',
      },
    },
    {
      id: 'postpartum-mental-health',
      title: 'Perinatal Mental Health & Postpartum Depression',
      category: 'Postpartum',
      readingTime: '5 min read',
      audience: 'Clinical Midwife',
      icon: '🧠',
      tagColor: 'teal',
      summary: 'Differentiating Baby Blues from Postpartum Depression (PPD) and clinical administration of the Edinburgh Postnatal Depression Scale.',
      keyPoints: [
        'Baby Blues: Affects up to 80% of mothers, peaks around Day 3-5, resolves spontaneously within 2 weeks',
        'Postpartum Depression (PPD): Persistent sad mood, insomnia, severe fatigue, feelings of worthlessness, lack of interest in infant',
        'Edinburgh Postnatal Depression Scale (EPDS): Score ≥10 indicates risk; question 10 on self-harm triggers immediate safety protocol',
        'Postpartum Psychosis: Obstetric-psychiatric emergency requiring immediate hospital admission',
      ],
      fullContent: {
        overview:
          'Maternal mental health is fundamental to successful maternal-infant bonding and child development. While transient emotional lability (Baby Blues) is common due to hormonal drops, unrecognized Postpartum Depression leads to prolonged maternal disability and potential self-harm.',
        clinicalSteps: [
          'Screen every mother at the 1-week and 6-week postnatal visits using the EPDS or 2-question Whooley screening tool.',
          'Ask: "During the past month, have you often been bothered by feeling down, depressed, or hopeless?" and "Have you had little interest or pleasure in doing things?"',
          'Evaluate safety: Explicitly review item 10 regarding thoughts of self-harm. Never leave a suicidal or psychotic mother unattended.',
          'Provide empathic support, engage spouse/family members in childcare relief, and refer to medical/psychiatric specialists when indicated.',
        ],
        patientCounseling: [
          'Normalize that feeling overwhelmed is common and that asking for emotional support is a sign of maternal strength, not weakness.',
          'Encourage sleep hygiene: sleep whenever the baby sleeps, and assign night bottle/diaper duties to supportive family members.',
        ],
        dohReferences: 'WHO mhGAP Intervention Guide: Perinatal Mental Health Module; DOH Mental Health Strategic Framework.',
      },
    },
    {
      id: 'kangaroo-mother-care',
      title: 'Kangaroo Mother Care (KMC) for Low Birth Weight',
      category: 'Newborn Care',
      readingTime: '4 min read',
      audience: 'Clinical Midwife',
      icon: '🦘',
      tagColor: 'blue',
      summary: 'Thermal regulation, continuous skin-to-skin positioning, and weight monitoring for infants born between 1,800g and 2,499g.',
      keyPoints: [
        'Indicated for stable low birth weight (<2,500g) and borderline preterm infants',
        'Continuous upright skin-to-skin contact between mother’s breasts (24 hours/day if feasible)',
        'Prevents hypothermia, apnea spells, and nosocomial infections while promoting rapid weight gain',
        'Exclusive breastfeeding support with expressed breast milk cup feeding if suckling is weak',
      ],
      fullContent: {
        overview:
          'Kangaroo Mother Care (KMC) is a scientifically validated intervention that provides natural incubator thermal stability, physiological regulation, and optimized neurodevelopment for low birth weight infants born in primary lying-in facilities.',
        clinicalSteps: [
          'Ensure infant is clinically stable (no severe respiratory distress, cyanosis, or active convulsions).',
          'KMC Position: Dress baby in only a diaper, cap, and warm socks. Place upright in vertical skin-to-skin contact between maternal breasts.',
          'Secure infant securely with a supportive binder or wrap tied firmly around maternal thorax.',
          'Keep infant airway clear: neck slightly extended, nose unobstructed, head turned to one side.',
          'Support continuous exclusive breastfeeding on demand every 2 hours. Monitor daily weight gain (target: 15 to 20 grams/kg/day).',
        ],
        patientCounseling: [
          'Show family members (father, grandmother) how to share KMC duties so mother can rest, shower, and recuperate.',
          'Reassure parents that mother’s body naturally adjusts its temperature upward or downward to warm or cool her baby.',
        ],
        dohReferences: 'DOH Administrative Order on Kangaroo Mother Care; WHO KMC Practical Guide.',
      },
    },
    {
      id: 'postpartum-family-planning',
      title: 'Postpartum Family Planning (PPFP) & Contraception',
      category: 'Postpartum',
      readingTime: '5 min read',
      audience: 'Patient Education',
      icon: '🛡️',
      tagColor: 'pink',
      summary: 'Lactational Amenorrhea Method (LAM) criteria, progestin-only pills (POPs), Depo injections, and subdermal implants.',
      keyPoints: [
        'Lactational Amenorrhea Method (LAM): 98% effective if: exclusively breastfeeding, amenorrheic, and baby <6 months',
        'Progestin-Only Pills (POPs): Safe during breastfeeding; can be initiated immediately postpartum or at 6 weeks',
        'DMPA Injection (Depo-Provera): Long-acting 3-month reversible method; can start at 6 weeks postpartum for breastfeeding mothers',
        'Subdermal Implants (Implanon): 3-year highly effective reversible progestin protection; does not diminish breast milk volume',
      ],
      fullContent: {
        overview:
          'Postpartum Family Planning (PPFP) prevents closely spaced and unintended pregnancies within the first 12 months after childbirth. Healthy birth spacing of at least 24 to 36 months between deliveries significantly reduces risks of preterm labor, low birth weight, and maternal anemia.',
        clinicalSteps: [
          'Antenatal PPFP Counseling: Introduce modern family planning methods during the third trimester visits.',
          'Assess LAM 3 Criteria: (1) Baby is exclusively breastfed day and night (no supplemental formula/water), (2) Mother has had no return of menstrual period, (3) Baby is less than 6 months old. If any criterion fails, initiate modern contraception immediately.',
          'Progestin-Only Methods: Safe for nursing mothers. Does not impair breast milk production unlike combined estrogen-progestin pills.',
          'Provide comprehensive informed choice, obtain signed consent, and document chosen family planning method in the maternal postpartum log.',
        ],
        patientCounseling: [
          'Remind mother that fertility can return prior to the first postpartum menstrual period.',
          'Clarify myths regarding hormonal contraceptives and assure mother of long-term safety and reversibility.',
        ],
        dohReferences: 'DOH Responsible Parenthood and Reproductive Health Act (RPRH Law - RA 10354) Clinical Service Guidelines.',
      },
    },
  ];

  readonly filteredArticles = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();

    return this.articles.filter((art) => {
      const matchCat = cat === 'All Topics' || art.category === cat;
      const matchQ =
        !q ||
        art.title.toLowerCase().includes(q) ||
        art.summary.toLowerCase().includes(q) ||
        art.keyPoints.some((k) => k.toLowerCase().includes(q)) ||
        art.category.toLowerCase().includes(q);

      return matchCat && matchQ;
    });
  });

  viewArticle(art: HealthArticle): void {
    this.selectedArticle.set(art);
  }

  closeArticleModal(): void {
    this.selectedArticle.set(null);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('All Topics');
  }

  openQuickProto(type: 'einc' | 'pph' | 'danger'): void {
    if (type === 'einc') {
      const art = this.articles.find((a) => a.id === 'einc-protocol');
      if (art) this.viewArticle(art);
    } else if (type === 'pph') {
      const art = this.articles.find((a) => a.id === 'pph-management');
      if (art) this.viewArticle(art);
    } else if (type === 'danger') {
      const art = this.articles.find((a) => a.id === 'preeclampsia-screening');
      if (art) this.viewArticle(art);
    }
  }

  printArticle(): void {
    window.print();
  }
}

