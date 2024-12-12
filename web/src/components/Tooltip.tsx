import { ReactElement, ReactNode } from 'react'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import { Placement } from 'react-bootstrap/esm/types'

export const TTip: React.FC<{ placement?: Placement; text: ReactNode; children: ReactElement }> = ({
  placement,
  text,
  children,
}) => {
  return (
    <OverlayTrigger placement={placement} overlay={(props) => <Tooltip {...props}>{text}</Tooltip>}>
      {children}
    </OverlayTrigger>
  )
}
