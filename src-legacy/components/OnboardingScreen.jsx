import { useState, useEffect } from 'react'

function OnboardingScreen({ onComplete }) {
  const [agreed, setAgreed] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    // Set default date to today
    const today = new Date().toISOString().slice(0, 10)
    setDate(today)
  }, [])

  const isFormValid = agreed && name.trim() && date

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isFormValid) {
      const timestamp = new Date().toISOString()
      
      // Submit to Netlify Forms for logging
      const formData = new FormData()
      formData.append('form-name', 'terms-acceptance')
      formData.append('name', name)
      formData.append('date', date)
      formData.append('timestamp', timestamp)
      formData.append('agreed', 'true')
      
      try {
        await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(formData).toString()
        })
        console.log('Terms acceptance logged to Netlify Forms')
      } catch (error) {
        console.error('Failed to log to Netlify Forms:', error)
        // Continue anyway - don't block user access
      }
      
      // Store onboarding completion in localStorage
      const onboardingData = {
        completed: true,
        name,
        date,
        timestamp
      }
      localStorage.setItem('onboarding_completed', JSON.stringify(onboardingData))
      onComplete()
    }
  }

  return (
    <div style={{
      background: '#f6f9fb',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      color: '#222',
      margin: 0,
      padding: 0,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        maxWidth: '540px',
        margin: '48px auto',
        background: '#fff',
        borderRadius: '10px',
        boxShadow: '0 2px 12px rgba(60,72,88,0.06)',
        padding: '36px 32px 28px 32px'
      }}>
        <h1 style={{
          fontSize: '1.6em',
          marginBottom: '6px'
        }}>
          Welcome – Terms of Use & Privacy Notice
        </h1>
        
        <div style={{
          maxHeight: '260px',
          overflowY: 'auto',
          border: '1px solid #d4dde0',
          borderRadius: '6px',
          padding: '18px 16px',
          marginBottom: '18px',
          background: '#f9fbfc',
          fontSize: '1em'
        }}>
          <p><strong>License and Access</strong><br/>
          You are granted a limited, non-exclusive right to access and use this web application (the "Application") for your organization's internal business purposes. You may not share your access credentials or attempt to disrupt or interfere with the Application's operation.</p>
          
          <p><strong>No Warranty</strong><br/>
          The Application is provided "as is" and "as available." Canyon Creek Enterprises, Inc. makes no warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, or reliability of performance. You assume all responsibility for how you use the Application and the data generated from it.</p>
          
          <p><strong>Limitation of Liability</strong><br/>
          Canyon Creek Enterprises, Inc. shall not be responsible for any damages or losses, including data loss, downtime, or indirect or consequential damages arising from the use of or inability to use the Application. Your sole remedy for dissatisfaction with the Application is to stop using it.</p>
          
          <p><strong>Indemnity and Release</strong><br/>
          You agree to indemnify and hold harmless Canyon Creek Enterprises, Inc. and its representatives from any claims, losses, or liabilities arising out of your use or misuse of the Application. By continuing, you release Canyon Creek Enterprises, Inc. from any claims related to such use.</p>
          
          <p><strong>Privacy and Data Handling</strong><br/>
          The Application may collect limited information necessary for authentication, performance monitoring, and service improvement. Data will be used only for operational purposes and will not be sold or shared with third parties except as required by law. By using the Application, you consent to data collection and handling in accordance with applicable privacy laws and Canyon Creek Enterprises, Inc.'s policies.</p>
          
          <p><strong>Termination of Access</strong><br/>
          Access may be suspended or terminated if you violate these terms. Upon termination, you must discontinue use of the Application and delete any data downloaded from it.</p>
          
          <p><strong>Governing Law</strong><br/>
          These terms are governed by the laws of your state or jurisdiction, without regard to conflict of law principles.</p>
          
          <p>By continuing, you confirm that you have read, understood, and agree to these terms and the privacy notice. If you do not agree, please do not use the Application.</p>
        </div>

        <form 
          name="terms-acceptance"
          method="POST"
          data-netlify="true"
          data-netlify-honeypot="bot-field"
          onSubmit={handleSubmit}
        >
          {/* Hidden fields for Netlify Forms */}
          <input type="hidden" name="form-name" value="terms-acceptance" />
          <input type="hidden" name="bot-field" />
          <input type="hidden" name="timestamp" value={new Date().toISOString()} />
          <div style={{
            marginBottom: '22px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '9px'
          }}>
            <input
              type="checkbox"
              id="agree"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
              style={{
                marginTop: '2px',
                accentColor: '#4b72c2'
              }}
            />
            <label 
              htmlFor="agree"
              style={{
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              I agree to the Terms of Use and Privacy Notice
            </label>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '18px'
          }}>
            <input
              type="text"
              name="name"
              id="name"
              placeholder="Full Name"
              required
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                flex: 1,
                padding: '7px 9px',
                borderRadius: '4px',
                border: '1px solid #cbd6db',
                fontSize: '1em',
                background: '#f6f9fb'
              }}
            />
            <input
              type="date"
              name="date"
              id="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                flex: 1,
                padding: '7px 9px',
                borderRadius: '4px',
                border: '1px solid #cbd6db',
                fontSize: '1em',
                background: '#f6f9fb'
              }}
            />
          </div>
          
          <button
            type="submit"
            disabled={!isFormValid}
            style={{
              background: isFormValid ? '#4b72c2' : '#b7c9e3',
              color: '#fff',
              padding: '12px 28px',
              border: 'none',
              borderRadius: '5px',
              fontSize: '1.1em',
              cursor: isFormValid ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              transition: 'background 0.15s',
              width: '100%'
            }}
          >
            Continue to Application
          </button>
        </form>
      </div>
    </div>
  )
}

export default OnboardingScreen
