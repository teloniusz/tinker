import { Form } from "react-bootstrap"


const capitalize = (s: string) => s.length ? s[0].toUpperCase() + s.slice(1) : s;

const detectType = (s: string) => {
    const matches: Record<string, string> = {
        'password': 'password',
        'email': 'email',
    };
    for (let el in matches) {
        if (s.match(new RegExp(el)))
            return matches[el];
    }
    return 'text';
}

export const FormItem: React.FC<{
    name: string
    label?: string
    placeholder?: string
    type?: string
    required?: boolean
    readOnly?: boolean
    value?: string
    defaultValue?: string
    errors?: Record<string, string[]>
}> = ({ name, label, placeholder, type, readOnly, errors, ...rest }) => {
    const id = `input${capitalize(name)}`;
    const err = errors || {};
    return (
        <Form.Group className="mb-3">
            <Form.Label htmlFor={id}>{label || capitalize(name)}</Form.Label>
            <Form.Control {...(readOnly && !type ? { readOnly, type: 'plaintext', ...rest } : {
                placeholder: placeholder || `Enter ${label || capitalize(name)}`,
                type: type || detectType(name.toLowerCase()),
                id, name, readOnly, ...rest,
                isInvalid: !!err[name]
            })}
            />
            {err[name] && (
                <Form.Control.Feedback type="invalid">
                    {err[name].join(", ")}
                </Form.Control.Feedback>
            )}
        </Form.Group>
    )
};