import { useCallback, useState } from 'react'
import { useGoogleReCaptcha, GoogleReCaptcha } from "react-google-recaptcha-v3"

export const useCaptcha = () => {
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const { executeRecaptcha } = useGoogleReCaptcha();

    const captchaChange = useCallback((token: string | null) => {
        setCaptchaToken(token);
    }, [setCaptchaToken]);

    const reloadCaptcha = async () => {
        if (executeRecaptcha) {
            setCaptchaToken(await executeRecaptcha());
        }
    }

    const Captcha = useCallback(() => {
        return <div id="captcha"><GoogleReCaptcha onVerify={captchaChange} /></div>
    }, [captchaChange])

    return { captchaToken, reloadCaptcha, Captcha }
}

